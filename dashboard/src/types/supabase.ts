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
                Row: any
                Insert: any
                Update: any
            }
        }
    }
}
