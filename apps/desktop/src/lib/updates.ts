import { invoke } from "@tauri-apps/api/core";

export interface StudioUpdate {
  version: string;
  notes: string;
}

/** The Rust updater uses the embedded Tauri public key to verify installers. */
export function checkStudioUpdate(): Promise<StudioUpdate | null> {
  return invoke<StudioUpdate | null>("check_studio_update");
}

/** The Rust side rechecks the requested version, then installs only signed bytes. */
export function installStudioUpdate(expectedVersion: string): Promise<void> {
  return invoke<void>("install_studio_update", { expectedVersion });
}
