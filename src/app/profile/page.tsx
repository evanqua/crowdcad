'use client';

import React, { useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '@/hooks/useauth';
import { Avatar, Button, Card, CardBody, Input, Select, SelectItem, Tabs, Tab } from '@heroui/react';
import { auth, db } from '@/app/firebase';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, signOut, deleteUser } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import { DiagonalStreaksFixed } from '@/components/ui/diagonal-streaks-fixed';
import LoadingScreen from '@/components/ui/loading-screen';
import { User, Shield, Database, Settings, HelpCircle, LogOut, Trash2, Download, Eye, EyeOff } from 'lucide-react';

export default function ProfilePage() {
  const { user, ready } = useAuth();

  // Account state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [lastPasswordChange, setLastPasswordChange] = useState<Date | null>(null);

  // Data & Privacy state
  const [dispatchLogs, setDispatchLogs] = useState<unknown[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Preferences state

  // General state
  const [activeSection, setActiveSection] = useState('account');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user) return;

    // Load user data
    const loadUserData = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setLastPasswordChange(data.lastPasswordChange?.toDate() || null);
        }
      } catch (err) {
        console.error('Error loading user data:', err);
      }
    };

    // Load dispatch logs
    const loadDispatchLogs = async () => {
      try {
        const logsQuery = query(collection(db, 'dispatchLogs'), where('userId', '==', user.uid));
        const logsSnap = await getDocs(logsQuery);
        setDispatchLogs(logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Error loading dispatch logs:', err);
      }
    };

    loadUserData();
    loadDispatchLogs();
  }, [user, ready]);

  if (!ready) return <LoadingScreen label="Loading…" />;
  if (!user) return <div className="p-8">You are not signed in.</div>;

  const handleChangePassword = async () => {
    if (!auth.currentUser) return setMessage('Not signed in');
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError('Enter your current password');
      return;
    }
    if (!newPassword) {
      setPasswordError('Enter a new password');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordSaving(true);
    setMessage(null);
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email || '', currentPassword);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, newPassword);
      
      // Update last password change
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, { lastPasswordChange: new Date() }, { merge: true });
      setLastPasswordChange(new Date());
      
      setMessage('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
    } catch (err) {
      if (err instanceof FirebaseError) {
        const code = err.code;
        const message = err.message;
        if (code === 'auth/wrong-password' || /wrong-password|invalid-credential/i.test(message)) {
          setPasswordError('Current password is incorrect');
          setMessage(null);
        } else {
          setPasswordError(null);
          setMessage(err.message || 'Failed to update password');
        }
      } else {
        setPasswordError(null);
        setMessage(err instanceof Error ? err.message : 'Failed to update password');
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to sign out');
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser || !deletePassword) {
      setMessage('Enter your password to confirm deletion');
      return;
    }

    setDeleting(true);
    setMessage(null);
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email || '', deletePassword);
      await reauthenticateWithCredential(auth.currentUser, cred);
      
      // Delete user data
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await deleteDoc(userRef);
      
      // Delete account
      await deleteUser(auth.currentUser);
    } catch (err) {
      if (err instanceof FirebaseError) {
        const code = err.code;
        const message = err.message;
        if (code === 'auth/wrong-password' || /wrong-password|invalid-credential/i.test(message)) {
          setMessage('Incorrect password');
        } else {
          setMessage(err.message || 'Failed to delete account');
        }
      } else {
        setMessage(err instanceof Error ? err.message : 'Failed to delete account');
      }
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeletePassword('');
    }
  };

  const handleExportData = () => {
    const data = {
      user: user,
      dispatchLogs: dispatchLogs,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crowdcad-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="relative h-[calc(100vh-4rem)] bg-surface-deepest text-surface-light overflow-hidden">
      <DiagonalStreaksFixed />
      <div className="relative z-10 h-full">
        <div className="flex h-[calc(100vh-4rem)] max-w-[1200px] mx-auto">
          <Tabs
            isVertical
            selectedKey={activeSection}
            onSelectionChange={(key) => setActiveSection(key as string)}
            classNames={{
              base: "h-full",
              tabList: "sticky top-0 h-full w-64 border-r border-default-200 bg-transparent p-4",
              tab: "justify-start h-12 text-base",
              panel: "h-full flex-1 overflow-y-auto p-6 w-full"
            }}
          >
            <Tab
              key="account"
              title={
                <div className="flex items-center gap-2 w-full">
                  <User className="w-4 h-4" />
                  <span>Account</span>
                </div>
              }
            >
              <div className="space-y-6 w-full">
                <h2 className="text-3xl font-bold mb-6">Account</h2>
                    
                    <Card isBlurred className="w-full border border-default-200 bg-surface-deep/40">
                      <CardBody className="p-6">
                        <h3 className="text-xl font-semibold mb-4">Profile Information</h3>
                        <div className="flex items-center gap-4 mb-4">
                          <Avatar
                            name={user.displayName || user.email || 'U'}
                            isBordered
                            showFallback
                            className="w-16 h-16"
                          />
                          <div>
                            <p className="text-lg font-medium">{user.displayName || 'No display name'}</p>
                            <p className="text-surface-light/70">{user.email}</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    <Card isBlurred className="w-full border border-default-200 bg-surface-deep/40">
                      <CardBody className="p-6">
                        <h3 className="text-xl font-semibold mb-4">Security</h3>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium mb-2">Current Password</label>
                              <div className="relative">
                                <Input
                                  type={showCurrentPassword ? "text" : "password"}
                                  value={currentPassword}
                                  onChange={(e) => setCurrentPassword(e.target.value)}
                                  placeholder="Enter current password"
                                  classNames={{
                                    inputWrapper: "rounded-2xl px-4 hover:bg-surface-deep",
                                    input: "text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none",
                                  }}
                                  endContent={
                                    <button
                                      type="button"
                                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                      className="text-surface-light/70 hover:text-surface-light"
                                    >
                                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                  }
                                />
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium mb-2">New Password</label>
                                <div className="relative">
                                  <Input
                                    type={showNewPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    classNames={{
                                      inputWrapper: "rounded-2xl px-4 hover:bg-surface-deep",
                                      input: "text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none",
                                    }}
                                    endContent={
                                      <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="text-surface-light/70 hover:text-surface-light"
                                      >
                                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                      </button>
                                    }
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                                <div className="relative">
                                  <Input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    classNames={{
                                      inputWrapper: "rounded-2xl px-4 hover:bg-surface-deep",
                                      input: "text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none",
                                    }}
                                    endContent={
                                      <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="text-surface-light/70 hover:text-surface-light"
                                      >
                                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                      </button>
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-end">
                              <Button onClick={handleChangePassword} disabled={passwordSaving} className="bg-accent w-full">
                                {passwordSaving ? 'Updating...' : 'Update Password'}
                              </Button>
                            </div>
                          </div>
                          {passwordError && <p className="text-status-red text-sm">{passwordError}</p>}
                          {lastPasswordChange && (
                            <p className="text-xs text-surface-light/70">
                              Last changed: {lastPasswordChange.toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </CardBody>
                    </Card>

                    <Card isBlurred className="w-full border border-default-200 bg-surface-deep/40">
                      <CardBody className="p-6">
                        <h3 className="text-xl font-semibold mb-4">Session</h3>
                        <Button onClick={handleSignOut} startContent={<LogOut className="w-4 h-4" />} className="w-full bg-accent">
                          Sign Out
                        </Button>
                      </CardBody>
                    </Card>
                  </div>
            </Tab>

            <Tab
              key="affiliations"
              title={
                <div className="flex items-center gap-2 w-full">
                  <Shield className="w-4 h-4" />
                  <span>Affiliations & Access</span>
                </div>
              }
            >
              <div className="space-y-6 w-full">
                <h2 className="text-3xl font-bold mb-6">Affiliations & Access</h2>
                    
                    <Card isBlurred className="w-full border border-default-200 bg-surface-deep/40">
                      <CardBody className="p-6">
                        <p className="text-surface-light/70">Organization features are currently unavailable.</p>
                      </CardBody>
                    </Card>
                  </div>
            </Tab>

            <Tab
              key="data-privacy"
              title={
                <div className="flex items-center gap-2 w-full">
                  <Database className="w-4 h-4" />
                  <span>Data & Privacy</span>
                </div>
              }
            >
              <div className="space-y-6 w-full">
                <h2 className="text-3xl font-bold mb-6">Data & Privacy</h2>
                    
                    <Card isBlurred className="w-full border border-default-200 bg-surface-deep/40">
                      <CardBody className="p-6">
                        <h3 className="text-xl font-semibold mb-4">Your Data</h3>
                        <div className="space-y-4">
                          <div>
                            <p className="font-medium mb-2">Dispatch Logs</p>
                            <p className="text-sm text-surface-light/70">{dispatchLogs.length} entries</p>
                          </div>
                          <Button onClick={handleExportData} startContent={<Download className="w-4 h-4" />}>
                            Export Data
                          </Button>
                        </div>
                      </CardBody>
                    </Card>

                    <Card isBlurred className="w-full border border-default-200 bg-surface-deep/40">
                      <CardBody className="p-6">
                        <div className="space-y-4">
                          <div>
                            <p className="font-medium mb-2">Delete Account</p>
                            <p className="text-sm text-surface-light/70 mb-4">
                              This will permanently delete your account and all associated data.
                            </p>
                            <Button 
                              onClick={() => setShowDeleteConfirm(true)} 
                              color="danger" 
                              startContent={<Trash2 className="w-4 h-4" />}
                            >
                              Delete Account
                            </Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </div>
            </Tab>

            <Tab
              key="preferences"
              title={
                <div className="flex items-center gap-2 w-full">
                  <Settings className="w-4 h-4" />
                  <span>Preferences</span>
                </div>
              }
            >
              <div className="space-y-6 w-full">
                <h2 className="text-3xl font-bold mb-6">Preferences</h2>
                  <Card isBlurred className="w-full border border-default-200 bg-surface-deep/40">
                    <CardBody className="p-6">
                      <p className="text-surface-light/70">Preferences configuration coming soon...</p>
                    </CardBody>
                  </Card>
                </div>
            </Tab>
          </Tabs>
        </div>
      </div>

      {/* Message Toast */}
      {message && (
        <div className="fixed bottom-4 right-4 z-50 p-4 bg-accent/90 border border-accent/20 rounded shadow-lg">
          <p className="text-white">{message}</p>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full bg-surface-deepest border border-status-red/30">
            <CardBody className="p-6">
              <h3 className="text-xl font-semibold text-status-red mb-2">Delete Account</h3>
              <p className="text-surface-light/80 mb-4">
                This action cannot be undone. All your data will be permanently deleted.
              </p>
              <p className="text-sm text-surface-faint mb-4">Enter your password to confirm:</p>
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Your password"
              />
              <div className="flex gap-3 mt-4">
                <Button
                  onClick={handleDeleteAccount}
                  color="danger"
                  disabled={deleting || !deletePassword}
                  className="flex-1"
                >
                  {deleting ? 'Deleting...' : 'Delete Account'}
                </Button>
                <Button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePassword('');
                    setMessage(null);
                  }}
                  variant="bordered"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
              {message && <p className="mt-3 text-sm text-status-red">{message}</p>}
            </CardBody>
          </Card>
        </div>
      )}
    </main>
  );
}
