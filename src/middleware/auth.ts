import { Env, User } from '../types/env';

/**
 * Represents the result of an authentication attempt.
 */
export interface AuthResult {
  /**
   * Whether the authentication was successful.
   */
  success: boolean;
  /**
   * The authenticated user object, if successful.
   */
  user?: User;
  /**
   * An error message, if authentication failed.
   */
  error?: string;
}

/**
 * A middleware class for handling JWT-based authentication.
 * NOTE: This is a simplified implementation for demonstration purposes.
 * For production, it is highly recommended to use a robust, well-tested JWT library.
 */
export class AuthMiddleware {
  /**
   * Authenticates an incoming request by verifying the JWT from the Authorization header.
   * @param {Request} request - The incoming request object.
   * @param {Env} env - The environment object containing the JWT secret.
   * @returns {Promise<AuthResult>} A promise that resolves to an AuthResult object.
   */
  static async authenticate(request: Request, env: Env): Promise<AuthResult> {
    try {
      const authHeader = request.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
          success: false,
          error: 'Missing or invalid authorization header'
        };
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Verify JWT token
      const user = await this.verifyToken(token, env);
      
      if (!user) {
        return {
          success: false,
          error: 'Invalid or expired token'
        };
      }

      return {
        success: true,
        user
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  /**
   * Verifies a JWT token's signature and expiration.
   * @param {string} token - The JWT token to verify.
   * @param {Env} env - The environment object containing the JWT secret.
   * @returns {Promise<User | null>} A promise that resolves to the user object if the token is valid, or null otherwise.
   * @private
   */
  private static async verifyToken(token: string, env: Env): Promise<User | null> {
    try {
      // Simple JWT verification - in production, use a proper JWT library
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(atob(parts[1]));
      
      // Check expiration
      if (payload.exp && payload.exp < Date.now() / 1000) {
        return null;
      }

      // Verify signature (simplified - use proper crypto in production)
      const expectedSignature = await this.createSignature(
        `${parts[0]}.${parts[1]}`,
        env.JWT_SECRET
      );
      
      if (parts[2] !== expectedSignature) {
        return null;
      }

      return {
        id: payload.sub,
        email: payload.email,
        permissions: payload.permissions || [],
        createdAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : new Date().toISOString()
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  /**
   * Creates an HMAC SHA-256 signature for the JWT.
   * @param {string} data - The data to sign (the encoded header and payload).
   * @param {string} secret - The secret key for signing.
   * @returns {Promise<string>} A promise that resolves to the base64url-encoded signature.
   * @private
   */
  private static async createSignature(data: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generates a new JWT for a given user.
   * @param {Partial<User>} user - The user object (or partial user object) to encode in the token.
   * @param {Env} env - The environment object containing the JWT secret.
   * @returns {Promise<string>} A promise that resolves to the generated JWT string.
   */
  static async generateToken(user: Partial<User>, env: Env): Promise<string> {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const payload = {
      sub: user.id,
      email: user.email,
      permissions: user.permissions || [],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };

    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '');
    
    const signature = await this.createSignature(
      `${encodedHeader}.${encodedPayload}`,
      env.JWT_SECRET
    );

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }
}
