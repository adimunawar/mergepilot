export interface UserProfile {
  name?: string;
}

export function formatProfileName(profile: UserProfile | null): string {
  return profile!.name!.trim();
}
