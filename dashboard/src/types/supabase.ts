export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            [key: string]: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                Row: any
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                Insert: any
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                Update: any
            }
        }
    }
}
