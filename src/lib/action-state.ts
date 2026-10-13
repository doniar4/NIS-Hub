export type ActionState = { error?: string; success?: string; retryAfterSeconds?: number };
export type FormAction = (state: ActionState, form: FormData) => Promise<ActionState>;
