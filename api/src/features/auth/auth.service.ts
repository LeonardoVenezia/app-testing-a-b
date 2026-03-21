import { userRepository } from "@repository";
import { TiendanubeAuthInterface, LoginRequestInterface } from "@features/auth";

/**
 * In production mode, the back-end needs to implement its own authentication for the API.
 */
class AuthService {
    async login(loginRequest: LoginRequestInterface): Promise<TiendanubeAuthInterface | null> {
        const store = await userRepository.findFirst();
        if (!store) return null;
        return {
            user_id: store.user_id,
            access_token: store.access_token ?? undefined,
            token_type: store.token_type ?? undefined,
            scope: store.scope ?? undefined,
            error: store.error ?? undefined,
            error_description: store.error_description ?? undefined,
        };
    }
}

export default new AuthService();