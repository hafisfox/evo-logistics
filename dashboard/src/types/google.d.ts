// Google One Tap Types
interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
  clientId?: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  context?: 'signin' | 'signup' | 'use';
  ux_mode?: 'popup' | 'redirect';
  login_uri?: string;
}

interface GooglePromptMomentNotification {
  isDisplayMoment: () => boolean;
  isDisplayed: () => boolean;
  isNotDisplayed: () => boolean;
  getNotDisplayedReason: () => string;
  isSkippedMoment: () => boolean;
  getSkippedReason: () => string;
  isDismissedMoment: () => boolean;
  getDismissedReason: () => string;
}

interface GoogleAccountsIdApi {
  initialize: (config: GoogleIdConfiguration) => void;
  prompt: (callback?: (notification: GooglePromptMomentNotification) => void) => void;
  cancel: () => void;
  disableAutoSelect: () => void;
  storeCredential: (
    credential: GoogleCredentialResponse,
    callback?: () => void
  ) => void;
  revoke: (login_hint: string, callback?: () => void) => void;
}

interface GoogleAccounts {
  id: GoogleAccountsIdApi;
}

interface Window {
  google?: {
    accounts: GoogleAccounts;
  };
}
