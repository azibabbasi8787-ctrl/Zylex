import React, { useState, useEffect, useRef } from 'react';
import { useAuth, ADMIN_EMAIL } from '../context/AuthContext';
import { Navbar } from './Navbar';
import { UserProfile, CourseLesson, AccountStatus } from '../types';
import {
  db,
  getSecondaryAuth,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import {
  extractDriveFileId,
  extractDriveFolderId,
  getDrivePreviewUrl,
  getDriveThumbnailUrl,
  fetchDriveTitle,
  fetchDriveFolderFiles,
  DriveFolderFile,
} from '../lib/driveHelper';
import {
  Users,
  Video,
  FolderUp,
  Folder,
  CheckSquare,
  Square,
  ListPlus,
  UploadCloud,
  Loader2,
  UserPlus,
  UserCheck,
  ShieldAlert,
  Ban,
  CheckCircle,
  Trash2,
  Edit2,
  KeyRound,
  ExternalLink,
  Plus,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Copy,
  Check,
  HelpCircle,
  Sparkles,
  Info,
  Play,
  X,
  Search,
  Filter,
  Maximize,
  Minimize,
  Expand,
  Shrink,
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'students' | 'videos' | 'guide'>('students');

  // Students state
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');

  // Lessons state
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);

  // Modals state
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showEditStudentModal, setShowEditStudentModal] = useState<UserProfile | null>(null);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState<UserProfile | null>(null);

  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [showEditLessonModal, setShowEditLessonModal] = useState<CourseLesson | null>(null);
  const [previewVideoLesson, setPreviewVideoLesson] = useState<CourseLesson | null>(null);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [isPreviewTheaterMode, setIsPreviewTheaterMode] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const togglePreviewFullscreen = async () => {
    if (!previewContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        if (previewContainerRef.current.requestFullscreen) {
          await previewContainerRef.current.requestFullscreen();
        } else if ((previewContainerRef.current as any).webkitRequestFullscreen) {
          await (previewContainerRef.current as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch {
      setIsPreviewTheaterMode((prev) => !prev);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsPreviewFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Form states - Add Student
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentPassword, setNewStudentPassword] = useState('');
  const [studentFormLoading, setStudentFormLoading] = useState(false);
  const [studentFormError, setStudentFormError] = useState<string | null>(null);
  const [createdStudentNotice, setCreatedStudentNotice] = useState<{ email: string; pass: string; name: string } | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Form states - Add Lesson
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDriveUrl, setLessonDriveUrl] = useState('');
  const [lessonDuration, setLessonDuration] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonIsPublished, setLessonIsPublished] = useState(true);
  const [lessonFormLoading, setLessonFormLoading] = useState(false);
  const [lessonFormError, setLessonFormError] = useState<string | null>(null);

  // Auto-detection states for Drive video title
  const [isDetectingTitle, setIsDetectingTitle] = useState(false);
  const [detectedTitleNotice, setDetectedTitleNotice] = useState<string | null>(null);
  const [isDetectingEditTitle, setIsDetectingEditTitle] = useState(false);

  // Mass Upload from Google Drive Folder states
  const [showMassUploadModal, setShowMassUploadModal] = useState(false);
  const [massUploadFolderUrl, setMassUploadFolderUrl] = useState('');
  const [isScanningFolder, setIsScanningFolder] = useState(false);
  const [massUploadError, setMassUploadError] = useState<string | null>(null);
  const [scannedFolderTitle, setScannedFolderTitle] = useState('');
  const [scannedVideos, setScannedVideos] = useState<
    Array<{
      id: string;
      title: string;
      rawName: string;
      driveUrl: string;
      duration: string;
      selected: boolean;
    }>
  >([]);
  const [isExecutingMassImport, setIsExecutingMassImport] = useState(false);
  const [massImportProgress, setMassImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [massPublishImmediate, setMassPublishImmediate] = useState(true);

  // Notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Mass selection states
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [selectedStudentUids, setSelectedStudentUids] = useState<string[]>([]);

  // Custom In-App Confirmation Dialog state (avoids sandboxed window.confirm blocking)
  interface ConfirmDialogState {
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    itemCount?: number;
    itemPreviews?: string[];
    action: () => Promise<void>;
  }
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [isExecutingConfirm, setIsExecutingConfirm] = useState(false);

  // Auto-detect title from Google Drive whenever link changes in Add Lesson modal
  useEffect(() => {
    if (!showAddLessonModal) {
      setDetectedTitleNotice(null);
      return;
    }

    const driveId = extractDriveFileId(lessonDriveUrl);
    if (!driveId) return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsDetectingTitle(true);
      try {
        const res = await fetchDriveTitle(lessonDriveUrl);
        if (res && res.title && isMounted) {
          // If title field is empty or matches previous auto-detected title, auto-fill it
          setLessonTitle((prev) => (!prev || prev === detectedTitleNotice ? res.title : prev));
          setDetectedTitleNotice(res.title);
        }
      } catch (err) {
        console.warn('Auto title detect error:', err);
      } finally {
        if (isMounted) setIsDetectingTitle(false);
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [lessonDriveUrl, showAddLessonModal]);

  const handleManualDetectTitle = async () => {
    const driveId = extractDriveFileId(lessonDriveUrl);
    if (!driveId) {
      triggerToast('Please paste a valid Google Drive link first.');
      return;
    }
    setIsDetectingTitle(true);
    try {
      const res = await fetchDriveTitle(lessonDriveUrl);
      if (res && res.title) {
        setLessonTitle(res.title);
        setDetectedTitleNotice(res.title);
        triggerToast(`Auto-detected title: "${res.title}"`);
      } else {
        triggerToast('Could not fetch title from Drive. Ensure link has view access.');
      }
    } catch {
      triggerToast('Failed to connect to Google Drive.');
    } finally {
      setIsDetectingTitle(false);
    }
  };

  const handleManualDetectEditTitle = async () => {
    if (!showEditLessonModal) return;
    const driveId = extractDriveFileId(showEditLessonModal.driveUrl);
    if (!driveId) {
      triggerToast('Please provide a valid Google Drive link.');
      return;
    }
    setIsDetectingEditTitle(true);
    try {
      const res = await fetchDriveTitle(showEditLessonModal.driveUrl);
      if (res && res.title) {
        setShowEditLessonModal({ ...showEditLessonModal, title: res.title });
        triggerToast(`Updated title: "${res.title}"`);
      } else {
        triggerToast('Could not fetch title from Drive. Ensure link has view access.');
      }
    } catch {
      triggerToast('Failed to connect to Google Drive.');
    } finally {
      setIsDetectingEditTitle(false);
    }
  };

  // --- MASS UPLOAD FROM GOOGLE DRIVE FOLDER HANDLERS ---
  const handleScanDriveFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const folderId = extractDriveFolderId(massUploadFolderUrl);
    if (!folderId) {
      setMassUploadError(
        'Please enter a valid Google Drive folder link (e.g., https://drive.google.com/drive/folders/...).'
      );
      return;
    }

    setIsScanningFolder(true);
    setMassUploadError(null);
    setScannedVideos([]);

    try {
      const result = await fetchDriveFolderFiles(massUploadFolderUrl);
      if (!result || !result.files || result.files.length === 0) {
        setMassUploadError(
          'No files found in this Google Drive folder. Please ensure the folder is set to "Anyone with the link can view".'
        );
        return;
      }

      setScannedFolderTitle(result.folderTitle || 'Google Drive Folder');
      const preparedVideos = result.files.map((file, idx) => ({
        id: file.id,
        title: file.title || `Lesson ${idx + 1}`,
        rawName: file.rawName,
        driveUrl: file.driveUrl,
        duration: '20 mins',
        selected: true,
      }));

      setScannedVideos(preparedVideos);
      triggerToast(`Found ${preparedVideos.length} files in "${result.folderTitle}"!`);
    } catch (err: unknown) {
      console.error('Scan folder error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setMassUploadError(
        `Failed to scan folder: ${msg}. Make sure General Access is set to "Anyone with the link can view".`
      );
    } finally {
      setIsScanningFolder(false);
    }
  };

  const handleToggleSelectAll = (select: boolean) => {
    setScannedVideos((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  const handleToggleVideoSelection = (id: string) => {
    setScannedVideos((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleUpdateScannedTitle = (id: string, newTitle: string) => {
    setScannedVideos((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
    );
  };

  const handleUpdateScannedDuration = (id: string, newDuration: string) => {
    setScannedVideos((prev) =>
      prev.map((item) => (item.id === id ? { ...item, duration: newDuration } : item))
    );
  };

  const handleExecuteMassImport = async () => {
    const selected = scannedVideos.filter((v) => v.selected);
    if (selected.length === 0) {
      triggerToast('Please select at least one video to import.');
      return;
    }

    setIsExecutingMassImport(true);
    setMassImportProgress({ current: 0, total: selected.length });

    try {
      const startingOrder = lessons.length > 0 ? Math.max(...lessons.map((l) => l.order)) + 1 : 1;

      for (let i = 0; i < selected.length; i++) {
        const item = selected[i];
        const lessonRef = doc(collection(db, 'lessons'));
        const newLesson: CourseLesson = {
          id: lessonRef.id,
          title: item.title.trim(),
          driveUrl: item.driveUrl,
          driveFileId: item.id,
          order: startingOrder + i,
          duration: item.duration.trim() || '20 mins',
          description: `Imported from Google Drive folder: ${scannedFolderTitle}`,
          isPublished: massPublishImmediate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await setDoc(lessonRef, newLesson);
        setMassImportProgress({ current: i + 1, total: selected.length });
      }

      triggerToast(`Successfully imported ${selected.length} videos from Google Drive!`);
      setShowMassUploadModal(false);
      // Reset
      setMassUploadFolderUrl('');
      setScannedVideos([]);
      setScannedFolderTitle('');
      setMassImportProgress(null);
    } catch (err: unknown) {
      console.error('Mass import error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      triggerToast(`Mass import failed: ${msg}`);
    } finally {
      setIsExecutingMassImport(false);
    }
  };

  // Realtime listener for Students
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: UserProfile[] = snapshot.docs
          .map((d) => ({ ...d.data(), uid: d.id } as UserProfile))
          .filter((u) => u.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase() && u.role !== 'admin');
        setStudents(fetched);
        setStudentsLoading(false);
      },
      (error) => {
        console.error('Error fetching students:', error);
        handleFirestoreError(error, OperationType.LIST, 'users');
        setStudentsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Realtime listener for Lessons
  useEffect(() => {
    const q = query(collection(db, 'lessons'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: CourseLesson[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as CourseLesson[];
        setLessons(fetched);
        setLessonsLoading(false);
      },
      (error) => {
        console.error('Error fetching lessons:', error);
        handleFirestoreError(error, OperationType.LIST, 'lessons');
        setLessonsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Generate random password for student
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 10; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  // 1. Add New Student
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentEmail.trim() || !newStudentPassword) {
      setStudentFormError('Please fill in student name, email, and password.');
      return;
    }

    setStudentFormLoading(true);
    setStudentFormError(null);

    try {
      // Create student auth using secondary app so admin stays logged in
      const secondaryAuth = getSecondaryAuth();
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        newStudentEmail.trim(),
        newStudentPassword
      );
      await signOut(secondaryAuth);

      const studentUid = userCredential.user.uid;
      const studentProfile: UserProfile = {
        uid: studentUid,
        name: newStudentName.trim(),
        email: newStudentEmail.trim().toLowerCase(),
        role: 'student',
        status: 'active',
        initialPassword: newStudentPassword,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', studentUid), studentProfile);

      setCreatedStudentNotice({
        name: newStudentName.trim(),
        email: newStudentEmail.trim().toLowerCase(),
        pass: newStudentPassword,
      });

      // Reset form fields
      setNewStudentName('');
      setNewStudentEmail('');
      setNewStudentPassword('');
      triggerToast('Student account created successfully!');
    } catch (err: unknown) {
      console.error('Create student error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('email-already-in-use')) {
        setStudentFormError('An account with this email address already exists.');
      } else if (msg.includes('weak-password')) {
        setStudentFormError('Password is too weak. Please use at least 6 characters.');
      } else if (msg.includes('operation-not-allowed')) {
        setStudentFormError(
          'Email/Password sign-in is not enabled in Firebase. In the Firebase Console, go to Authentication -> Sign-in method -> Email/Password and click Enable.'
        );
      } else {
        setStudentFormError(`Failed to create student: ${msg}`);
      }
    } finally {
      setStudentFormLoading(false);
    }
  };

  // 2. Edit Student Details
  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditStudentModal) return;
    try {
      await updateDoc(doc(db, 'users', showEditStudentModal.uid), {
        name: showEditStudentModal.name,
        updatedAt: new Date().toISOString(),
      });
      triggerToast('Student details updated.');
      setShowEditStudentModal(null);
    } catch (err) {
      console.error('Update student error:', err);
      triggerToast('Failed to update student.');
    }
  };

  // 3. Change / Reset Student Password
  const handleSendPasswordReset = async (email: string) => {
    try {
      const secondaryAuth = getSecondaryAuth();
      await sendPasswordResetEmail(secondaryAuth, email);
      triggerToast(`Password reset link sent to ${email}`);
      setShowResetPasswordModal(null);
    } catch (err: unknown) {
      console.error('Password reset error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      triggerToast(`Could not send reset email: ${msg}`);
    }
  };

  // 4. Block Student Access
  const handleBlockStudent = async (student: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', student.uid), {
        status: 'blocked',
        updatedAt: new Date().toISOString(),
      });
      triggerToast(`Student ${student.name} is now blocked.`);
    } catch (err) {
      console.error('Block student error:', err);
      triggerToast('Failed to block student.');
    }
  };

  // 5. Reactivate Student Access
  const handleReactivateStudent = async (student: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', student.uid), {
        status: 'active',
        updatedAt: new Date().toISOString(),
      });
      triggerToast(`Student ${student.name} reactivated.`);
    } catch (err) {
      console.error('Reactivate student error:', err);
      triggerToast('Failed to reactivate student.');
    }
  };

  // 6. Revoke Student Access
  const handleRevokeStudent = (student: UserProfile) => {
    setConfirmDialog({
      title: 'Revoke Course Enrollment',
      message: `Are you sure you want to revoke course access for "${student.name}"? The student will be blocked from accessing course videos.`,
      confirmText: 'Revoke Access',
      isDestructive: true,
      action: async () => {
        try {
          await updateDoc(doc(db, 'users', student.uid), {
            status: 'revoked',
            updatedAt: new Date().toISOString(),
          });
          triggerToast(`Access revoked for ${student.name}.`);
        } catch (err) {
          console.error('Revoke student error:', err);
          triggerToast('Failed to revoke access.');
        }
      },
    });
  };

  // 7. Delete Student Account (Zero window.confirm, uses in-app modal)
  const handleDeleteStudent = (student: UserProfile) => {
    setConfirmDialog({
      title: 'Delete Student Account',
      message: `Permanently delete ${student.name} (${student.email}) from the academy? This will immediately revoke their access.`,
      confirmText: 'Delete Student',
      isDestructive: true,
      action: async () => {
        try {
          await deleteDoc(doc(db, 'users', student.uid));
          setSelectedStudentUids((prev) => prev.filter((id) => id !== student.uid));
          triggerToast(`Student ${student.name} deleted.`);
        } catch (err: unknown) {
          console.error('Delete student error:', err);
          const msg = err instanceof Error ? err.message : String(err);
          triggerToast(`Failed to delete student: ${msg}`);
        }
      },
    });
  };

  // Mass Delete Students
  const handleMassDeleteStudents = () => {
    const toDelete = students.filter((s) => selectedStudentUids.includes(s.uid));
    if (toDelete.length === 0) {
      triggerToast('Please select at least one student to delete.');
      return;
    }

    setConfirmDialog({
      title: `Mass Delete ${toDelete.length} Students`,
      message: `You are about to permanently remove ${toDelete.length} student account(s). Their course access will be revoked immediately.`,
      confirmText: `Delete ${toDelete.length} Students`,
      isDestructive: true,
      itemCount: toDelete.length,
      itemPreviews: toDelete.map((s) => `${s.name} (${s.email})`),
      action: async () => {
        try {
          await Promise.all(toDelete.map((s) => deleteDoc(doc(db, 'users', s.uid))));
          setSelectedStudentUids([]);
          triggerToast(`Successfully deleted ${toDelete.length} student account(s).`);
        } catch (err: unknown) {
          console.error('Mass delete students error:', err);
          const msg = err instanceof Error ? err.message : String(err);
          triggerToast(`Mass delete failed: ${msg}`);
        }
      },
    });
  };

  // --- COURSE VIDEO MANAGEMENT ---

  // Add Video
  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    const driveFileId = extractDriveFileId(lessonDriveUrl);
    if (!lessonTitle.trim()) {
      setLessonFormError('Please enter a lesson title.');
      return;
    }
    if (!driveFileId) {
      setLessonFormError(
        'Invalid Google Drive link. Please paste a valid Google Drive video link or file ID (e.g., https://drive.google.com/file/d/.../view).'
      );
      return;
    }

    setLessonFormLoading(true);
    setLessonFormError(null);

    try {
      const nextOrder = lessons.length > 0 ? Math.max(...lessons.map((l) => l.order)) + 1 : 1;
      const lessonRef = doc(collection(db, 'lessons'));
      const newLesson: CourseLesson = {
        id: lessonRef.id,
        title: lessonTitle.trim(),
        driveUrl: lessonDriveUrl.trim(),
        driveFileId,
        order: nextOrder,
        duration: lessonDuration.trim() || '20 mins',
        description: lessonDescription.trim(),
        isPublished: lessonIsPublished,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(lessonRef, newLesson);
      triggerToast('Lesson published successfully!');
      setShowAddLessonModal(false);
      // Reset
      setLessonTitle('');
      setLessonDriveUrl('');
      setLessonDuration('');
      setLessonDescription('');
    } catch (err: unknown) {
      console.error('Add lesson error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setLessonFormError(`Failed to save lesson: ${msg}`);
    } finally {
      setLessonFormLoading(false);
    }
  };

  // Edit Video
  const handleUpdateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditLessonModal) return;
    const driveFileId = extractDriveFileId(showEditLessonModal.driveUrl);
    if (!driveFileId) {
      triggerToast('Invalid Google Drive video link.');
      return;
    }

    try {
      await updateDoc(doc(db, 'lessons', showEditLessonModal.id), {
        title: showEditLessonModal.title.trim(),
        driveUrl: showEditLessonModal.driveUrl.trim(),
        driveFileId,
        duration: showEditLessonModal.duration || '20 mins',
        description: showEditLessonModal.description || '',
        isPublished: showEditLessonModal.isPublished,
        updatedAt: new Date().toISOString(),
      });
      triggerToast('Lesson updated successfully.');
      setShowEditLessonModal(null);
    } catch (err) {
      console.error('Update lesson error:', err);
      triggerToast('Failed to update lesson.');
    }
  };

  // Delete Video (Zero window.confirm, uses in-app modal)
  const handleDeleteLesson = (lesson: CourseLesson) => {
    setConfirmDialog({
      title: 'Delete Course Video',
      message: `Are you sure you want to permanently delete "${lesson.title}"? Students will immediately lose access to this video.`,
      confirmText: 'Delete Video',
      isDestructive: true,
      action: async () => {
        try {
          await deleteDoc(doc(db, 'lessons', lesson.id));
          setSelectedLessonIds((prev) => prev.filter((id) => id !== lesson.id));
          triggerToast(`Video "${lesson.title}" deleted.`);
        } catch (err: unknown) {
          console.error('Delete lesson error:', err);
          const msg = err instanceof Error ? err.message : String(err);
          triggerToast(`Failed to delete video: ${msg}`);
        }
      },
    });
  };

  // Mass Delete Videos
  const handleMassDeleteLessons = () => {
    const toDelete = lessons.filter((l) => selectedLessonIds.includes(l.id));
    if (toDelete.length === 0) {
      triggerToast('Please select at least one video to delete.');
      return;
    }

    setConfirmDialog({
      title: `Mass Delete ${toDelete.length} Videos`,
      message: `You are about to permanently delete ${toDelete.length} course video(s). This action cannot be undone.`,
      confirmText: `Delete ${toDelete.length} Videos`,
      isDestructive: true,
      itemCount: toDelete.length,
      itemPreviews: toDelete.map((l) => l.title),
      action: async () => {
        try {
          await Promise.all(toDelete.map((l) => deleteDoc(doc(db, 'lessons', l.id))));
          setSelectedLessonIds([]);
          triggerToast(`Successfully deleted ${toDelete.length} video(s).`);
        } catch (err: unknown) {
          console.error('Mass delete error:', err);
          const msg = err instanceof Error ? err.message : String(err);
          triggerToast(`Mass delete failed: ${msg}`);
        }
      },
    });
  };

  // Reorder Videos: Move Up / Down
  const handleMoveLessonOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;

    const currentLesson = lessons[index];
    const targetLesson = lessons[targetIndex];

    try {
      await updateDoc(doc(db, 'lessons', currentLesson.id), {
        order: targetLesson.order,
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'lessons', targetLesson.id), {
        order: currentLesson.order,
        updatedAt: new Date().toISOString(),
      });
      triggerToast('Video sequence updated.');
    } catch (err) {
      console.error('Reorder error:', err);
      triggerToast('Failed to reorder lessons.');
    }
  };

  // Toggle Publish
  const handleTogglePublish = async (lesson: CourseLesson) => {
    try {
      await updateDoc(doc(db, 'lessons', lesson.id), {
        isPublished: !lesson.isPublished,
        updatedAt: new Date().toISOString(),
      });
      triggerToast(lesson.isPublished ? 'Lesson set to draft.' : 'Lesson published to students.');
    } catch (err) {
      console.error('Toggle publish error:', err);
    }
  };

  // Seed sample lessons if empty
  const handleSeedSampleLessons = () => {
    setConfirmDialog({
      title: 'Seed Sample Course Lessons',
      message: 'Add 3 sample Digital Marketing lessons with Google Drive templates to your course?',
      confirmText: 'Add 3 Samples',
      isDestructive: false,
      action: async () => {
        const sampleLessons = [
          {
            title: '01. Foundations of Modern Digital Marketing & Growth Strategy',
            driveUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/preview',
            duration: '22:45',
            description: 'Core overview of customer acquisition funnels, digital marketing channels, and persona targeting.',
            isPublished: true,
          },
          {
            title: '02. Search Engine Optimization (SEO) & High-Intent Keyword Mapping',
            driveUrl: 'https://drive.google.com/file/d/1_wKj2wA9f8Xg-y3zZf3mN1B9m4v1p5q7/preview',
            duration: '31:10',
            description: 'How to discover buyer-intent search queries, optimize on-page signals, and master technical SEO.',
            isPublished: true,
          },
          {
            title: '03. High-Converting Meta & Google Paid Ads Setup',
            driveUrl: 'https://drive.google.com/file/d/1C0wKj3wA9f8Xg-y3zZf3mN1B9m4v1p8q/preview',
            duration: '27:30',
            description: 'Building profitable advertising campaigns on Meta Ads Manager and Google Search Ads from scratch.',
            isPublished: true,
          },
        ];

        try {
          for (let i = 0; i < sampleLessons.length; i++) {
            const item = sampleLessons[i];
            const fileId = extractDriveFileId(item.driveUrl) || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs';
            const docRef = doc(collection(db, 'lessons'));
            await setDoc(docRef, {
              id: docRef.id,
              title: item.title,
              driveUrl: item.driveUrl,
              driveFileId: fileId,
              order: lessons.length + i + 1,
              duration: item.duration,
              description: item.description,
              isPublished: item.isPublished,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
          triggerToast('Sample lessons seeded successfully!');
        } catch (err: unknown) {
          console.error('Seed error:', err);
          const msg = err instanceof Error ? err.message : String(err);
          triggerToast(`Could not seed lessons: ${msg}`);
        }
      },
    });
  };

  // Copy helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  };

  // Filter students
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.status === 'active').length;
  const blockedStudents = students.filter((s) => s.status === 'blocked' || s.status === 'revoked').length;
  const totalLessons = lessons.length;

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col text-slate-100">
      <Navbar activeAdminTab={activeTab} onSelectAdminTab={setActiveTab} />

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center space-x-2 border border-blue-400/30 animate-bounce">
          <CheckCircle className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mobile Tab Switcher */}
        <div className="flex md:hidden items-center justify-between bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl mb-6">
          <button
            onClick={() => setActiveTab('students')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'students' ? 'bg-blue-600 text-white shadow' : 'text-slate-400'
            }`}
          >
            Students
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'videos' ? 'bg-blue-600 text-white shadow' : 'text-slate-400'
            }`}
          >
            Videos
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'guide' ? 'bg-blue-600 text-white shadow' : 'text-slate-400'
            }`}
          >
            Drive Guide
          </button>
        </div>

        {/* DASHBOARD OVERVIEW STATS */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Students */}
          <div className="bg-[#0d162a] border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Enrolled</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">{totalStudents}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">Registered students</span>
          </div>

          {/* Active Students */}
          <div className="bg-[#0d162a] border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Access</span>
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">{activeStudents}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">Currently authorized</span>
          </div>

          {/* Blocked Students */}
          <div className="bg-[#0d162a] border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Blocked / Revoked</span>
              <Ban className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">{blockedStudents}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">Access restricted</span>
          </div>

          {/* Total Lessons */}
          <div className="bg-[#0d162a] border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Course Lessons</span>
              <Video className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400">{totalLessons}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">Drive video modules</span>
          </div>
        </section>

        {/* TAB 1: STUDENT MANAGEMENT */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            {/* Header & Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d162a] border border-slate-800 p-5 rounded-2xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span>Student Management</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Authorize, monitor, block, and provision private student accounts.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                {selectedStudentUids.length > 0 && (
                  <button
                    onClick={handleMassDeleteStudents}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600 hover:text-white text-xs font-semibold shadow-md transition-all animate-in fade-in"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Mass Delete ({selectedStudentUids.length})</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setNewStudentPassword(generateRandomPassword());
                    setShowAddStudentModal(true);
                    setStudentFormError(null);
                    setCreatedStudentNotice(null);
                  }}
                  className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 transition-all self-start sm:self-auto"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add New Student</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search by student name or email..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Students ({students.length})</option>
                  <option value="active">Active Only ({activeStudents})</option>
                  <option value="blocked">Blocked / Suspended ({blockedStudents})</option>
                </select>
              </div>
            </div>

            {/* Student Table */}
            <div className="bg-[#0d162a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              {studentsLoading ? (
                <div className="py-20 text-center text-xs text-slate-400">Loading students...</div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-20 text-center p-6">
                  <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">No students found</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {studentSearch
                      ? 'No students match your filter criteria.'
                      : 'Click "Add New Student" above to enroll your first student.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0b1222] border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3.5 px-3 sm:px-4 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredStudents.length > 0 &&
                              selectedStudentUids.length === filteredStudents.length
                            }
                            onChange={() => {
                              if (selectedStudentUids.length === filteredStudents.length) {
                                setSelectedStudentUids([]);
                              } else {
                                setSelectedStudentUids(filteredStudents.map((s) => s.uid));
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500/40 cursor-pointer"
                            title="Select all students"
                          />
                        </th>
                        <th className="py-3.5 px-4 sm:px-6">Student Name</th>
                        <th className="py-3.5 px-4 sm:px-6">Email / Username</th>
                        <th className="py-3.5 px-4 sm:px-6">Account Status</th>
                        <th className="py-3.5 px-4 sm:px-6">Enrolled</th>
                        <th className="py-3.5 px-4 sm:px-6 text-right">Account Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredStudents.map((student) => {
                        const isSelected = selectedStudentUids.includes(student.uid);
                        return (
                          <tr
                            key={student.uid}
                            className={`transition-colors ${
                              isSelected ? 'bg-blue-900/15' : 'hover:bg-slate-900/40'
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-4 px-3 sm:px-4 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedStudentUids((prev) =>
                                    prev.includes(student.uid)
                                      ? prev.filter((id) => id !== student.uid)
                                      : [...prev, student.uid]
                                  );
                                }}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500/40 cursor-pointer"
                              />
                            </td>

                            {/* Name */}
                            <td className="py-4 px-4 sm:px-6 font-semibold text-white">
                              {student.name}
                            </td>

                            {/* Email */}
                            <td className="py-4 px-4 sm:px-6 text-slate-300">
                              <span className="font-mono text-xs">{student.email}</span>
                            </td>

                            {/* Status */}
                            <td className="py-4 px-4 sm:px-6">
                              {student.status === 'active' ? (
                                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>Active</span>
                                </span>
                              ) : student.status === 'blocked' ? (
                                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                  <span>Blocked</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold text-[11px]">
                                  <span>Revoked</span>
                                </span>
                              )}
                            </td>

                            {/* Date */}
                            <td className="py-4 px-4 sm:px-6 text-slate-400 text-[11px]">
                              {student.createdAt
                                ? new Date(student.createdAt).toLocaleDateString()
                                : 'Recent'}
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-4 sm:px-6 text-right space-x-1.5 whitespace-nowrap">
                              {/* Edit details */}
                              <button
                                onClick={() => setShowEditStudentModal(student)}
                                className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                                title="Edit Student Details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Password reset modal trigger */}
                              <button
                                onClick={() => setShowResetPasswordModal(student)}
                                className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                                title="Change / Reset Password"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>

                              {/* Block / Reactivate toggle */}
                              {student.status === 'active' ? (
                                <button
                                  onClick={() => handleBlockStudent(student)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 font-medium transition-colors"
                                  title="Immediately block student from course portal"
                                >
                                  Block
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleReactivateStudent(student)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 font-medium transition-colors"
                                  title="Restore student course access"
                                >
                                  Reactivate
                                </button>
                              )}

                              {/* Revoke Access */}
                              {student.status !== 'revoked' && (
                                <button
                                  onClick={() => handleRevokeStudent(student)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                  title="Revoke course enrollment"
                                >
                                  Revoke
                                </button>
                              )}

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteStudent(student)}
                                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                title="Delete student record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: COURSE VIDEO MANAGEMENT */}
        {activeTab === 'videos' && (
          <div className="space-y-6">
            {/* Header & Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d162a] border border-slate-800 p-5 rounded-2xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Video className="w-5 h-5 text-blue-400" />
                  <span>Manage Course Videos</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Add, edit, reorder, and publish Google Drive video lessons for your Digital Marketing Course.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                {lessons.length > 0 && (
                  <button
                    onClick={() => {
                      if (selectedLessonIds.length === lessons.length) {
                        setSelectedLessonIds([]);
                      } else {
                        setSelectedLessonIds(lessons.map((l) => l.id));
                      }
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all"
                  >
                    {selectedLessonIds.length === lessons.length ? (
                      <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>
                      {selectedLessonIds.length === lessons.length ? 'Deselect All' : 'Select All'}
                    </span>
                  </button>
                )}

                {selectedLessonIds.length > 0 && (
                  <button
                    onClick={handleMassDeleteLessons}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600 hover:text-white text-xs font-semibold shadow-md transition-all animate-in fade-in"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Mass Delete ({selectedLessonIds.length})</span>
                  </button>
                )}

                {lessons.length === 0 && (
                  <button
                    onClick={handleSeedSampleLessons}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>Seed Samples</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowMassUploadModal(true);
                    setMassUploadError(null);
                    setScannedVideos([]);
                  }}
                  className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 hover:from-blue-600 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/40 transition-all border border-blue-400/30"
                >
                  <FolderUp className="w-4 h-4" />
                  <span>Mass Upload from Folder</span>
                </button>

                <button
                  onClick={() => {
                    setShowAddLessonModal(true);
                    setLessonFormError(null);
                  }}
                  className="inline-flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-semibold transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Single Video</span>
                </button>
              </div>
            </div>

            {/* Video List */}
            {lessonsLoading ? (
              <div className="py-20 text-center text-xs text-slate-400">Loading course videos...</div>
            ) : lessons.length === 0 ? (
              <div className="py-20 text-center bg-[#0d162a] border border-slate-800 rounded-2xl p-8">
                <Video className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-200">No course videos added yet</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Paste a Google Drive folder link to import all your videos automatically with their titles, or add a single video.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setShowMassUploadModal(true);
                      setMassUploadError(null);
                      setScannedVideos([]);
                    }}
                    className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 shadow-lg shadow-blue-900/30"
                  >
                    <FolderUp className="w-4 h-4" />
                    <span>Mass Upload from Drive Folder</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowAddLessonModal(true);
                      setLessonFormError(null);
                    }}
                    className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-800"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Single Video</span>
                  </button>
                  <button
                    onClick={handleSeedSampleLessons}
                    className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs font-medium hover:text-white"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>Seed 3 Samples</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {lessons.map((lesson, index) => {
                  const isLessonSelected = selectedLessonIds.includes(lesson.id);
                  return (
                    <div
                      key={lesson.id}
                      className={`bg-[#0d162a] border ${
                        isLessonSelected
                          ? 'border-blue-500/60 bg-blue-950/20 shadow-md shadow-blue-950/30'
                          : 'border-slate-800 hover:border-slate-700'
                      } rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all`}
                    >
                      {/* Left: Sequence, Checkbox and info */}
                      <div className="flex items-start sm:items-center space-x-3.5">
                        {/* Checkbox for mass select */}
                        <div className="pt-1 sm:pt-0 shrink-0">
                          <input
                            type="checkbox"
                            checked={isLessonSelected}
                            onChange={() => {
                              setSelectedLessonIds((prev) =>
                                prev.includes(lesson.id)
                                  ? prev.filter((id) => id !== lesson.id)
                                  : [...prev, lesson.id]
                              );
                            }}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500/40 cursor-pointer"
                            title="Select video for mass delete"
                          />
                        </div>

                        {/* Order controls */}
                        <div className="flex flex-col items-center justify-center space-y-1 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
                          <button
                            onClick={() => handleMoveLessonOrder(index, 'up')}
                            disabled={index === 0}
                            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[11px] font-bold text-blue-400 px-1">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <button
                            onClick={() => handleMoveLessonOrder(index, 'down')}
                            disabled={index === lessons.length - 1}
                            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Title and details */}
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-bold text-white line-clamp-1">
                              {lesson.title}
                            </h3>
                            {lesson.isPublished ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                                Published
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-semibold">
                                Draft
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-3 mt-1 text-[11px] text-slate-400">
                            <span>Duration: {lesson.duration || 'N/A'}</span>
                            <span>&bull;</span>
                            <span className="font-mono text-slate-500 truncate max-w-[200px] sm:max-w-xs">
                              Drive ID: {lesson.driveFileId}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
                        {/* Play / Test preview button */}
                        <button
                          onClick={() => setPreviewVideoLesson(lesson)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600 hover:text-white text-xs font-semibold transition-all"
                          title="Preview video playback"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Preview Player</span>
                        </button>

                        {/* Toggle Published / Draft */}
                        <button
                          onClick={() => handleTogglePublish(lesson)}
                          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
                          title={lesson.isPublished ? 'Unpublish (make draft)' : 'Publish to students'}
                        >
                          {lesson.isPublished ? (
                            <Eye className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {/* Edit lesson */}
                        <button
                          onClick={() => setShowEditLessonModal(lesson)}
                          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
                          title="Edit Lesson"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete lesson */}
                        <button
                          onClick={() => handleDeleteLesson(lesson)}
                          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete Lesson"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GOOGLE DRIVE SHARING GUIDE */}
        {activeTab === 'guide' && (
          <div className="bg-[#0d162a] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center space-x-3 text-blue-400 mb-2">
              <HelpCircle className="w-7 h-7" />
              <h2 className="text-xl font-bold text-white tracking-tight">
                Google Drive Video Sharing Guide
              </h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Zylex Academy plays your course videos directly from your Google Drive using Google’s secure embedded preview player. Follow these steps so your students can stream your videos seamlessly:
            </p>

            {/* Step by step */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 font-black text-sm flex items-center justify-center">
                  1
                </div>
                <h4 className="text-sm font-bold text-white">Upload Video to Drive</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Upload your Digital Marketing MP4 or video files into your Google Drive folder.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 font-black text-sm flex items-center justify-center">
                  2
                </div>
                <h4 className="text-sm font-bold text-white">Set General Access</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Right click the video &rarr; Click <span className="text-white font-semibold">Share</span> &rarr; Under General Access, change to <span className="text-emerald-400 font-semibold">"Anyone with the link can view"</span>.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 font-black text-sm flex items-center justify-center">
                  3
                </div>
                <h4 className="text-sm font-bold text-white">Paste Link in Academy</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Click <span className="text-white font-semibold">Copy link</span>, go to <span className="text-blue-400 font-semibold">Manage Course Videos</span>, paste it, and save.
                </p>
              </div>
            </div>

            {/* Important notice on sharing permissions requested in user prompt */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
              <div className="flex items-center space-x-2 font-bold text-amber-300">
                <Info className="w-4 h-4 shrink-0" />
                <span>Security &amp; Permissions Note on Google Drive Links:</span>
              </div>
              <p className="leading-relaxed">
                When you share a video via Google Drive with "Anyone with the link can view", the embedded player streams inside Zylex Academy without requiring students to upload anything elsewhere.
                However, please note that because Google Drive links are link-accessible, technically any student who inspects network traffic could copy that direct Drive URL and view it outside the portal. This is standard behavior for link-shared Google Drive files. For private courses, your access gate is Zylex Academy itself, where only students you enroll receive login credentials to see the catalog.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* --- MODAL 1: ADD NEW STUDENT --- */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d162a] border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowAddStudentModal(false);
                setCreatedStudentNotice(null);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Add New Student</h3>
                <p className="text-xs text-slate-400">Enroll student into Zylex Academy</p>
              </div>
            </div>

            {/* If student just created, show copy credentials banner */}
            {createdStudentNotice ? (
              <div className="space-y-4 my-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                  <CheckCircle className="w-4 h-4" />
                  <span>Student Account Created!</span>
                </div>
                <p className="text-xs text-slate-300">
                  Share these credentials with the student:
                </p>
                <div className="bg-slate-900/90 p-3 rounded-xl space-y-1 font-mono text-xs">
                  <div>
                    <span className="text-slate-500">Name:</span>{' '}
                    <span className="text-white">{createdStudentNotice.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Email:</span>{' '}
                    <span className="text-white">{createdStudentNotice.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Password:</span>{' '}
                    <span className="text-emerald-400 font-bold">{createdStudentNotice.pass}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      `Welcome to Zylex Academy!\nPortal: ${window.location.origin}\nEmail: ${createdStudentNotice.email}\nPassword: ${createdStudentNotice.pass}`
                    )
                  }
                  className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow"
                >
                  {copiedNotice ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedNotice ? 'Copied to Clipboard!' : 'Copy Invitation Message'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreatedStudentNotice(null)}
                  className="w-full py-2 text-xs text-slate-400 hover:text-white"
                >
                  Add Another Student
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddStudent} className="space-y-4">
                {studentFormError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    {studentFormError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Student Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={newStudentEmail}
                    onChange={(e) => setNewStudentEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Initial Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewStudentPassword(generateRandomPassword())}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold"
                    >
                      Generate Strong
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={newStudentPassword}
                    onChange={(e) => setNewStudentPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddStudentModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={studentFormLoading}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 disabled:opacity-50"
                  >
                    {studentFormLoading ? 'Enrolling...' : 'Create Student Account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL 2: EDIT STUDENT DETAILS --- */}
      {showEditStudentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d162a] border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setShowEditStudentModal(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-4">Edit Student Details</h3>

            <form onSubmit={handleEditStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Student Name
                </label>
                <input
                  type="text"
                  required
                  value={showEditStudentModal.name}
                  onChange={(e) =>
                    setShowEditStudentModal({ ...showEditStudentModal, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={showEditStudentModal.email}
                  className="w-full px-3.5 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl text-xs text-slate-400 cursor-not-allowed"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditStudentModal(null)}
                  className="px-4 py-2 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: RESET STUDENT PASSWORD --- */}
      {showResetPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d162a] border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setShowResetPasswordModal(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reset Student Password</h3>
                <p className="text-xs text-slate-400">{showResetPasswordModal.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed my-3">
              Send a secure password reset link directly to the student’s registered email address:
            </p>

            <div className="bg-slate-900 p-3 rounded-xl font-mono text-xs text-blue-400 mb-4">
              {showResetPasswordModal.email}
            </div>

            {showResetPasswordModal.initialPassword && (
              <div className="mb-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                <span className="text-slate-500 block text-[10px]">Previously recorded password:</span>
                <span className="font-mono text-slate-200">{showResetPasswordModal.initialPassword}</span>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowResetPasswordModal(null)}
                className="px-4 py-2 text-xs text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSendPasswordReset(showResetPasswordModal.email)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Send Reset Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: ADD COURSE VIDEO --- */}
      {showAddLessonModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d162a] border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddLessonModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Add New Course Video</h3>
                <p className="text-xs text-slate-400">Embed directly from Google Drive</p>
              </div>
            </div>

            {lessonFormError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {lessonFormError}
              </div>
            )}

            <form onSubmit={handleAddLesson} className="space-y-4">
              {/* Google Drive Video Link */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Google Drive Video Link
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={lessonDriveUrl}
                    onChange={(e) => setLessonDriveUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono pr-10"
                  />
                  {isDetectingTitle && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Paste your Google Drive link &mdash; the video title will be auto-detected!
                </p>
              </div>

              {/* Status and detected title preview */}
              {extractDriveFileId(lessonDriveUrl) && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-blue-300">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-mono truncate max-w-xs">
                        Drive ID: {extractDriveFileId(lessonDriveUrl)}
                      </span>
                    </div>
                    {isDetectingTitle ? (
                      <span className="text-[11px] text-blue-400 flex items-center space-x-1 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Fetching title...</span>
                      </span>
                    ) : detectedTitleNotice ? (
                      <span className="text-[11px] text-emerald-400 font-medium flex items-center space-x-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Title Detected</span>
                      </span>
                    ) : null}
                  </div>

                  {detectedTitleNotice && (
                    <div className="pt-1 border-t border-blue-500/20 text-[11px] text-slate-300 flex items-center justify-between">
                      <span className="truncate pr-2">
                        Drive Title: <strong className="text-white">"{detectedTitleNotice}"</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setLessonTitle(detectedTitleNotice)}
                        className="text-blue-400 hover:text-blue-300 font-semibold shrink-0"
                      >
                        Use This Title
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Lesson Title with Auto-Detect Button */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Lesson Title
                  </label>
                  <button
                    type="button"
                    onClick={handleManualDetectTitle}
                    disabled={isDetectingTitle || !extractDriveFileId(lessonDriveUrl)}
                    className="flex items-center space-x-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Fetch and set title from Google Drive video"
                  >
                    {isDetectingTitle ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    <span>Auto-Detect Title from Drive</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="e.g. 01. Introduction to Digital Marketing"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Estimated Duration
                  </label>
                  <input
                    type="text"
                    value={lessonDuration}
                    onChange={(e) => setLessonDuration(e.target.value)}
                    placeholder="e.g. 25 mins"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center space-x-2 cursor-pointer pb-2.5">
                    <input
                      type="checkbox"
                      checked={lessonIsPublished}
                      onChange={(e) => setLessonIsPublished(e.target.checked)}
                      className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-200 font-medium">Publish immediately</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Lesson Summary / Description (Optional)
                </label>
                <textarea
                  rows={3}
                  value={lessonDescription}
                  onChange={(e) => setLessonDescription(e.target.value)}
                  placeholder="Key topics covered in this lesson..."
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddLessonModal(false)}
                  className="px-4 py-2 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={lessonFormLoading}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 disabled:opacity-50"
                >
                  {lessonFormLoading ? 'Saving...' : 'Save & Publish Video'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 5: EDIT COURSE VIDEO --- */}
      {showEditLessonModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d162a] border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowEditLessonModal(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-4">Edit Course Video</h3>

            <form onSubmit={handleUpdateLesson} className="space-y-4">
              {/* Google Drive Video Link */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Google Drive Video Link
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={showEditLessonModal.driveUrl}
                    onChange={(e) =>
                      setShowEditLessonModal({ ...showEditLessonModal, driveUrl: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white font-mono pr-10"
                  />
                  {isDetectingEditTitle && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {/* Lesson Title with Auto-Detect Button */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Lesson Title
                  </label>
                  <button
                    type="button"
                    onClick={handleManualDetectEditTitle}
                    disabled={isDetectingEditTitle || !extractDriveFileId(showEditLessonModal.driveUrl)}
                    className="flex items-center space-x-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Auto-detect title from Google Drive"
                  >
                    {isDetectingEditTitle ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    <span>Auto-Detect Title from Drive</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={showEditLessonModal.title}
                  onChange={(e) =>
                    setShowEditLessonModal({ ...showEditLessonModal, title: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Estimated Duration
                  </label>
                  <input
                    type="text"
                    value={showEditLessonModal.duration || ''}
                    onChange={(e) =>
                      setShowEditLessonModal({ ...showEditLessonModal, duration: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center space-x-2 cursor-pointer pb-2.5">
                    <input
                      type="checkbox"
                      checked={showEditLessonModal.isPublished}
                      onChange={(e) =>
                        setShowEditLessonModal({
                          ...showEditLessonModal,
                          isPublished: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-200 font-medium">Published</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Lesson Summary
                </label>
                <textarea
                  rows={3}
                  value={showEditLessonModal.description || ''}
                  onChange={(e) =>
                    setShowEditLessonModal({
                      ...showEditLessonModal,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditLessonModal(null)}
                  className="px-4 py-2 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 6: PREVIEW VIDEO PLAYER --- */}
      {previewVideoLesson && (
        <div
          className={`fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center animate-fadeIn ${
            isPreviewTheaterMode || isPreviewFullscreen ? 'p-0' : 'p-3 sm:p-6'
          }`}
        >
          <div
            ref={previewContainerRef}
            className={`bg-[#0a0f1d] flex flex-col shadow-2xl overflow-hidden relative transition-all duration-200 ${
              isPreviewTheaterMode || isPreviewFullscreen
                ? 'w-screen h-screen max-w-none max-h-none rounded-none border-0'
                : 'border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[95vh]'
            }`}
          >
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-[#0e162b] shrink-0">
              <div className="flex items-center space-x-2 truncate pr-4">
                <span className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 text-xs font-bold shrink-0">
                  Admin Preview
                </span>
                <span className="text-xs sm:text-sm font-bold text-white truncate">
                  {previewVideoLesson.title}
                </span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                {/* Full Screen Toggle */}
                <button
                  type="button"
                  onClick={togglePreviewFullscreen}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                  title={isPreviewFullscreen ? 'Exit Full Screen' : 'Watch in Full Screen'}
                >
                  {isPreviewFullscreen ? (
                    <>
                      <Minimize className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Exit Full Screen</span>
                    </>
                  ) : (
                    <>
                      <Maximize className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Full Screen</span>
                    </>
                  )}
                </button>

                {/* Theater Mode Toggle */}
                <button
                  type="button"
                  onClick={() => setIsPreviewTheaterMode((prev) => !prev)}
                  className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  title={isPreviewTheaterMode ? 'Exit Theater Mode' : 'Theater Mode (Fill Window)'}
                >
                  {isPreviewTheaterMode ? <Shrink className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
                  <span>{isPreviewTheaterMode ? 'Standard' : 'Theater'}</span>
                </button>

                <button
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen().catch(() => {});
                    }
                    setIsPreviewTheaterMode(false);
                    setPreviewVideoLesson(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Close preview (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div
              className={`relative bg-black w-full flex items-center justify-center ${
                isPreviewTheaterMode || isPreviewFullscreen
                  ? 'flex-1 h-full min-h-0'
                  : 'aspect-video-container'
              }`}
            >
              <iframe
                src={getDrivePreviewUrl(previewVideoLesson.driveFileId)}
                title={previewVideoLesson.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 7: MASS UPLOAD FROM GOOGLE DRIVE FOLDER --- */}
      {showMassUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-[#0d162a] border border-slate-800 rounded-3xl w-full max-w-3xl p-6 sm:p-7 shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden">
            <button
              onClick={() => {
                if (isExecutingMassImport) return;
                setShowMassUploadModal(false);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center space-x-3 mb-5 shrink-0">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white shadow-lg shadow-blue-900/40 border border-blue-400/30">
                <FolderUp className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <span>Mass Upload from Google Drive Folder</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Bulk Import
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Paste a shared Google Drive folder link to automatically extract all videos with their titles.
                </p>
              </div>
            </div>

            {/* Error banner */}
            {massUploadError && (
              <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2 shrink-0">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{massUploadError}</span>
              </div>
            )}

            {/* Folder Input Form */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 mb-4 shrink-0">
              <form onSubmit={handleScanDriveFolder} className="space-y-3">
                <label className="block text-xs font-semibold text-slate-200">
                  Google Drive Folder Link
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    required
                    value={massUploadFolderUrl}
                    onChange={(e) => setMassUploadFolderUrl(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/15uNXeRBIhVvZJIhL4yTw4IsStMhUaaxl"
                    className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={isScanningFolder || isExecutingMassImport}
                    className="flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 disabled:opacity-50 shrink-0 transition-all"
                  >
                    {isScanningFolder ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Scanning Folder...</span>
                      </>
                    ) : (
                      <>
                        <Folder className="w-4 h-4" />
                        <span>Scan Folder</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                  <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>
                    Ensure your Google Drive folder is set to <strong>"Anyone with the link can view"</strong> so files can be retrieved.
                  </span>
                </div>
              </form>
            </div>

            {/* Scanning loading placeholder */}
            {isScanningFolder && (
              <div className="py-12 text-center my-auto">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                <p className="text-sm font-semibold text-white">Scanning Google Drive Folder...</p>
                <p className="text-xs text-slate-400 mt-1">
                  Retrieving video files and titles from Google Drive.
                </p>
              </div>
            )}

            {/* Scanned Videos List & Selection Area */}
            {!isScanningFolder && scannedVideos.length > 0 && (
              <div className="flex-1 overflow-hidden flex flex-col border border-slate-800 rounded-2xl bg-slate-950/60 p-4">
                {/* Result header & bulk actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 shrink-0">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Folder className="w-4 h-4 text-blue-400" />
                      <h4 className="text-xs font-bold text-white truncate max-w-sm">
                        {scannedFolderTitle}
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {scannedVideos.filter((v) => v.selected).length} of {scannedVideos.length} videos selected for import
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(true)}
                      className="text-[11px] font-semibold text-blue-400 hover:text-blue-300"
                    >
                      Select All
                    </button>
                    <span className="text-slate-600">&bull;</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(false)}
                      className="text-[11px] font-semibold text-slate-400 hover:text-white"
                    >
                      Deselect All
                    </button>
                    <span className="text-slate-600">&bull;</span>
                    <label className="flex items-center space-x-1.5 cursor-pointer text-[11px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={massPublishImmediate}
                        onChange={(e) => setMassPublishImmediate(e.target.checked)}
                        className="h-3.5 w-3.5 rounded bg-slate-900 border-slate-700 text-blue-600"
                      />
                      <span>Publish immediately</span>
                    </label>
                  </div>
                </div>

                {/* Scrollable list of scanned video items */}
                <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1">
                  {scannedVideos.map((item, index) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        item.selected
                          ? 'bg-slate-900/90 border-blue-500/40 shadow-sm'
                          : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                      }`}
                    >
                      {/* Checkbox and sequential index */}
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleVideoSelection(item.id)}
                          className="text-blue-400 hover:text-blue-300 shrink-0"
                        >
                          {item.selected ? (
                            <CheckSquare className="w-5 h-5 text-blue-500" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-500" />
                          )}
                        </button>

                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 shrink-0">
                          #{String(index + 1).padStart(2, '0')}
                        </span>

                        {/* Title input (editable) */}
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleUpdateScannedTitle(item.id, e.target.value)}
                            placeholder="Lesson Title"
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                          />
                          <span className="text-[10px] text-slate-500 truncate block mt-0.5 font-mono">
                            File: {item.rawName}
                          </span>
                        </div>
                      </div>

                      {/* Duration & Preview test */}
                      <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
                        <input
                          type="text"
                          value={item.duration}
                          onChange={(e) => handleUpdateScannedDuration(item.id, e.target.value)}
                          placeholder="Duration"
                          className="w-20 px-2 py-1 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-slate-300 text-center"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewVideoLesson({
                              id: item.id,
                              title: item.title,
                              driveUrl: item.driveUrl,
                              driveFileId: item.id,
                              order: index + 1,
                              isPublished: true,
                            })
                          }
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                          title="Preview video"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Import progress bar */}
                {isExecutingMassImport && massImportProgress && (
                  <div className="pt-3 border-t border-slate-800 shrink-0 space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>Importing videos into course...</span>
                      <span className="font-bold text-blue-400">
                        {massImportProgress.current} / {massImportProgress.total}
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                        style={{
                          width: `${(massImportProgress.current / massImportProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer Controls */}
            <div className="pt-4 mt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (isExecutingMassImport) return;
                  setShowMassUploadModal(false);
                }}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>

              {scannedVideos.length > 0 && (
                <button
                  type="button"
                  disabled={
                    isExecutingMassImport ||
                    scannedVideos.filter((v) => v.selected).length === 0
                  }
                  onClick={handleExecuteMassImport}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 disabled:opacity-50 transition-all"
                >
                  {isExecutingMassImport ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Adding to Academy...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>
                        Import &amp; Add{' '}
                        {scannedVideos.filter((v) => v.selected).length} Videos
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. IN-APP CONFIRMATION MODAL (Zero window.confirm, works reliably in iframe) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0d162a] border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative overflow-hidden">
            <div
              className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl ${
                confirmDialog.isDestructive
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                  : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
              } mb-4`}
            >
              {confirmDialog.isDestructive ? (
                <Trash2 className="w-6 h-6" />
              ) : (
                <HelpCircle className="w-6 h-6" />
              )}
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight">
              {confirmDialog.title}
            </h3>

            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              {confirmDialog.message}
            </p>

            {/* Item previews if mass delete */}
            {confirmDialog.itemPreviews && confirmDialog.itemPreviews.length > 0 && (
              <div className="mt-3.5 max-h-36 overflow-y-auto p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                {confirmDialog.itemPreviews.slice(0, 8).map((preview, idx) => (
                  <div key={idx} className="truncate text-slate-300 flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                    <span className="truncate">{preview}</span>
                  </div>
                ))}
                {confirmDialog.itemPreviews.length > 8 && (
                  <div className="text-[10px] text-slate-500 italic pt-1 pl-3.5">
                    + {confirmDialog.itemPreviews.length - 8} more items
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                type="button"
                disabled={isExecutingConfirm}
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-700/80 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExecutingConfirm}
                onClick={async () => {
                  setIsExecutingConfirm(true);
                  try {
                    await confirmDialog.action();
                    setConfirmDialog(null);
                  } catch (err) {
                    console.error('Confirmation action error:', err);
                  } finally {
                    setIsExecutingConfirm(false);
                  }
                }}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all shadow-lg disabled:opacity-50 ${
                  confirmDialog.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/30'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
                }`}
              >
                {isExecutingConfirm ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    {confirmDialog.isDestructive && <Trash2 className="w-3.5 h-3.5" />}
                    <span>{confirmDialog.confirmText || 'Confirm'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
