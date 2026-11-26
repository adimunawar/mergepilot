export interface Account {
  displayName?: string;
}

export function getDisplayName(account: Account | null): string {
  return account!.displayName!.trim();
}
