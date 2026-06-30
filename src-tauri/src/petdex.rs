use std::time::Duration;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use url::Url;

const PETDEX_MANIFEST_URL: &str = "https://petdex.dev/api/manifest";
const FEATURED_SKINS: [&str; 4] = ["boba", "tiko", "wangcai", "mallow"];

#[derive(Debug, Deserialize)]
struct PetdexManifest {
    pets: Vec<PetdexManifestPet>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PetdexManifestPet {
    slug: String,
    display_name: String,
    spritesheet_url: String,
    submitted_by: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PetdexSkin {
    id: String,
    display_name: String,
    source: &'static str,
    spritesheet_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    submitted_by: Option<String>,
}

#[tauri::command]
pub async fn list_featured_petdex_skins() -> Result<Vec<PetdexSkin>, String> {
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| format!("Could not prepare the Petdex request: {error}"))?;
    let response = client
        .get(PETDEX_MANIFEST_URL)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|error| format!("Could not reach Petdex: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Petdex returned an error: {error}"))?;
    let manifest = response
        .json::<PetdexManifest>()
        .await
        .map_err(|error| format!("Petdex returned invalid data: {error}"))?;
    Ok(select_featured_skins(manifest))
}

fn select_featured_skins(manifest: PetdexManifest) -> Vec<PetdexSkin> {
    FEATURED_SKINS
        .iter()
        .filter_map(|wanted| {
            let candidate = manifest.pets.iter().find(|pet| pet.slug == *wanted)?;
            if !safe_id(&candidate.slug) || !safe_asset_url(&candidate.spritesheet_url) {
                return None;
            }
            Some(PetdexSkin {
                id: candidate.slug.clone(),
                display_name: candidate.display_name.trim().to_owned(),
                source: "petdex",
                spritesheet_url: candidate.spritesheet_url.clone(),
                submitted_by: candidate
                    .submitted_by
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_owned),
            })
        })
        .filter(|skin| !skin.display_name.is_empty())
        .collect()
}

fn safe_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        && value
            .as_bytes()
            .first()
            .is_some_and(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
}

fn safe_asset_url(value: &str) -> bool {
    let Ok(url) = Url::parse(value) else {
        return false;
    };
    url.scheme() == "https"
        && url.host_str() == Some("assets.petdex.dev")
        && matches!(
            url.path().rsplit('.').next(),
            Some(extension) if extension.eq_ignore_ascii_case("png") || extension.eq_ignore_ascii_case("webp")
        )
}

#[cfg(test)]
mod tests {
    use super::{select_featured_skins, PetdexManifest, PetdexManifestPet};

    #[test]
    fn filters_and_orders_untrusted_manifest_entries() {
        let skins = select_featured_skins(PetdexManifest {
            pets: vec![
                pet("tiko", "Tiko", "https://evil.example/tiko.webp"),
                pet(
                    "boba",
                    "Boba",
                    "https://assets.petdex.dev/curated/boba/spritesheet.webp",
                ),
                pet(
                    "../../bad",
                    "Bad",
                    "https://assets.petdex.dev/bad/spritesheet.webp",
                ),
                pet(
                    "mallow",
                    "Mallow",
                    "https://assets.petdex.dev/pets/mallow/sprite.png",
                ),
            ],
        });

        assert_eq!(
            skins
                .iter()
                .map(|skin| skin.id.as_str())
                .collect::<Vec<_>>(),
            vec!["boba", "mallow"]
        );
    }

    fn pet(slug: &str, display_name: &str, spritesheet_url: &str) -> PetdexManifestPet {
        PetdexManifestPet {
            slug: slug.to_owned(),
            display_name: display_name.to_owned(),
            spritesheet_url: spritesheet_url.to_owned(),
            submitted_by: Some("creator".to_owned()),
        }
    }
}
