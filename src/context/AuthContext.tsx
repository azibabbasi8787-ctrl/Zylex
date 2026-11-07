import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, testConnection } from '../lib/firebase';
import { UserProfile, UserRole, AccountStatus } from '../types';

export const ADMIN_EMAIL = 'azibabbasi8787@gmail.com';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  isStudent: boolean;
  isActive: boolean;
  isBlocked: boolean;
  isRevoked: boolean;
  loading: boolean;
  loginWithEmail: (email: string, pass: string, rememberMe?: boolean) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Test connection on mount
  useEffect(() => {
    testConnection();
  }, []);

  // Listen to Auth State
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!user) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      const isBootstrappedAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const adminDocRef = doc(db, 'admins', user.uid);

        // Realtime listener for immediate revocation or unblocking
        unsubscribeProfile = onSnapshot(
          userDocRef,
          async (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as UserProfile;
              // If this user is the bootstrapped admin, always keep role as admin
              if (isBootstrappedAdmin) {
                if (data.role !== 'admin' || data.status !== 'active') {
                  setDoc(userDocRef, { ...data, role: 'admin', status: 'active', updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
                }
                setDoc(adminDocRef, {
                  uid: user.uid,
                  email: user.email || ADMIN_EMAIL,
                  createdAt: new Date().toISOString(),
                }, { merge: true }).catch(() => {});
                setUserProfile({ ...data, role: 'admin', status: 'active' });
              } else {
                setUserProfile(data);
              }
            } else {
              // Doc doesn't exist yet
              if (isBootstrappedAdmin) {
                // Auto create admin document
                const adminProfile: UserProfile = {
                  uid: user.uid,
                  email: user.email || ADMIN_EMAIL,
                  name: user.displayName || 'Administrator',
                  role: 'admin',
                  status: 'active',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                try {
                  await setDoc(userDocRef, adminProfile);
                  await setDoc(adminDocRef, {
                    uid: user.uid,
                    email: user.email || ADMIN_EMAIL,
                    createdAt: new Date().toISOString(),
                  });
                  setUserProfile(adminProfile);
                } catch (e) {
                  console.error('Failed to auto-create admin doc:', e);
                  // Provide fallback memory profile for bootstrapped admin
                  setUserProfile(adminProfile);
                }
              } else {
                // If student doc not found
                setUserProfile(null);
              }
            }
            setLoading(false);
          },
          (error) => {
            console.error('Profile snapshot error:', error);
            if (isBootstrappedAdmin) {
              setUserProfile({
                uid: user.uid,
                email: user.email || ADMIN_EMAIL,
                name: user.displayName || 'Administrator',
                role: 'admin',
                status: 'active',
              });
            }
            setLoading(false);
          }
        );
      } catch (err) {
        console.error('Auth state initialization error:', err);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const loginWithEmail = async (email: string, pass: string, rememberMe = true) => {
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    } catch {
      // Persistence fallback if blocked
    }
    await signInWithEmailAndPassword(auth, email.trim(), pass);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
    setUserProfile(null);
    setCurrentUser(null);
  };

  const refreshProfile = async () => {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      }
    } catch (e) {
      console.error('Refresh profile error:', e);
    }
  };

  const isBootstrapped = currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isAdmin = isBootstrapped || userProfile?.role === 'admin';
  const isStudent = !isAdmin && userProfile?.role === 'student';
  const isBlocked = userProfile?.status === 'blocked';
  const isRevoked = userProfile?.status === 'revoked';
  const isActive = (userProfile?.status === 'active' || isAdmin) && !isBlocked && !isRevoked;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isAdmin,
        isStudent,
        isActive,
        isBlocked,
        isRevoked,
        loading,
        loginWithEmail,
        loginWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
