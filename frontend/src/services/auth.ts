import api from './api'
import type { User } from '@/types'

export const authService = {
  login: (email: string, password: string, totp_code?: string) =>
    api.post<{ access: string; refresh: string; user: User }>('/auth/auth/login/', {
      email, password, ...(totp_code ? { totp_code } : {})
    }),

  logout: (refresh: string) =>
    api.post('/auth/auth/logout/', { refresh }),

  me: () =>
    api.get<User>('/auth/auth/me/'),

  changePassword: (old_password: string, new_password: string) =>
    api.post('/auth/auth/change_password/', { old_password, new_password }),
}
