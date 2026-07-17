import { create } from 'zustand'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../lib/firebase'
import type { AppUser } from '../types'

interface AuthState {
  user: User | null
  /** true até a primeira resposta do onAuthStateChanged. */
  loading: boolean
  /** Inicia o listener de auth. Retorna o unsubscribe. Chamar uma vez no App. */
  init: () => () => void
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

/** Cria o doc `users/{uid}` no primeiro login (não sobrescreve se já existe). */
async function ensureUserDocument(user: User): Promise<void> {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    const data: AppUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: serverTimestamp(),
    }
    await setDoc(ref, data)
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: () =>
    onAuthStateChanged(auth, (user) => {
      set({ user, loading: false })
      if (user) void ensureUserDocument(user)
    }),

  signInWithGoogle: async () => {
    await signInWithPopup(auth, googleProvider)
    // onAuthStateChanged atualiza o store e cria o doc de usuário.
  },

  logout: async () => {
    await signOut(auth)
  },
}))
