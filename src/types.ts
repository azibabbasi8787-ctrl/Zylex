export type UserRole = 'admin' | 'student';
export type AccountStatus = 'active' | 'blocked' | 'revoked';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  status: AccountStatus;
  initialPassword?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseLesson {
  id: string;
  title: string;
  description?: string;
  driveUrl: string;
  driveFileId: string;
  order: number;
  isPublished: boolean;
  duration?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminStats {
  totalStudents: number;
  activeStudents: number;
  blockedStudents: number;
  totalLessons: number;
}
