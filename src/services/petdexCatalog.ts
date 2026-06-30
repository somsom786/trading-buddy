import { invoke } from '@tauri-apps/api/core';
import { parsePetSkinSelections, type PetSkinSelection } from '../domain/petdex/skins';

type PetdexInvoker = (command: string) => Promise<unknown>;
const tauriInvoker: PetdexInvoker = (command) => invoke<unknown>(command);

export async function fetchFeaturedPetdexSkins(
  invoker: PetdexInvoker = tauriInvoker,
): Promise<PetSkinSelection[]> {
  if (!('__TAURI_INTERNALS__' in window) && invoker === tauriInvoker) {
    throw new Error('Petdex catalog is available in the desktop application.');
  }
  return parsePetSkinSelections(await invoker('list_featured_petdex_skins'));
}
