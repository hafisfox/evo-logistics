// Google One Tap Types
interface GoogleAccounts {
    id: {
        initialize: (config: any) => void;
        prompt: (callback?: (notification: any) => void) => void;
        cancel: () => void;
        disableAutoSelect: () => void;
        storeCredential: (credential: any, callback?: () => void) => void;
        revoke: (login_hint: string, callback?: () => void) => void;
    };
}

interface Window {
    google?: {
        accounts: GoogleAccounts;
    };
}
