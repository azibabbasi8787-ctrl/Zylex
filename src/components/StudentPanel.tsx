import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from './Navbar';
import { CourseLesson } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { getDrivePreviewUrl, getDriveThumbnailUrl } from '../lib/driveHelper';
import {
  Play,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  BookOpen,
  Search,
} from 'lucide-react';

export const StudentPanel: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<CourseLesson | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`zylex_completed_${currentUser?.uid}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save completed state to localStorage
  useEffect(() => {
    if (currentUser?.uid) {
      try {
        localStorage.setItem(`zylex_completed_${currentUser.uid}`, JSON.stringify(completedLessonIds));
      } catch (e) {
        console.error('Failed to save completed state', e);
      }
    }
  }, [completedLessonIds, currentUser?.uid]);

  // Listen to published lessons
  useEffect(() => {
    const q = query(
      collection(db, 'lessons'),
      where('isPublished', '==', true),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: CourseLesson[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as CourseLesson[];
        setLessons(fetched);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching lessons:', error);
        handleFirestoreError(error, OperationType.LIST, 'lessons');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const toggleLessonCompleted = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCompletedLessonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleNextLesson = () => {
    if (!activeLesson) return;
    const currentIndex = lessons.findIndex((l) => l.id === activeLesson.id);
    if (currentIndex >= 0 && currentIndex < lessons.length - 1) {
      setActiveLesson(lessons[currentIndex + 1]);
    }
  };

  const handlePrevLesson = () => {
    if (!activeLesson) return;
    const currentIndex = lessons.findIndex((l) => l.id === activeLesson.id);
    if (currentIndex > 0) {
      setActiveLesson(lessons[currentIndex - 1]);
    }
  };

  // Keyboard navigation for video player modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeLesson) return;
      if (e.key === 'Escape') setActiveLesson(null);
      if (e.key === 'ArrowRight') handleNextLesson();
      if (e.key === 'ArrowLeft') handlePrevLesson();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLesson, lessons]);

  const filteredLessons = lessons.filter(
    (l) =>
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.description && l.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const studentName = userProfile?.name || currentUser?.displayName || 'Student';
  const currentActiveIndex = activeLesson ? lessons.findIndex((l) => l.id === activeLesson.id) : -1;

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Course Banner */}
        <div className="relative rounded-3xl bg-gradient-to-r from-[#0d162d] via-[#101b38] to-[#0c142b] border border-blue-900/30 p-6 sm:p-8 md:p-10 shadow-2xl overflow-hidden mb-10">
          <div className="absolute -top-12 -right-12 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Private Video Course Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                Digital Marketing Mastery
              </h1>
              <p className="text-sm sm:text-base text-slate-300 font-medium">
                Welcome, <span className="text-blue-400 font-semibold">{studentName}</span>. Watch each lesson directly inside your portal.
              </p>
            </div>

            {/* Quick stats */}
            <div className="flex items-center space-x-4 bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 shrink-0 shadow-lg">
              <div className="text-center px-3">
                <span className="block text-2xl font-black text-white">{lessons.length}</span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Lessons</span>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div className="text-center px-3">
                <span className="block text-2xl font-black text-emerald-400">{completedLessonIds.length}</span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Watched</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter / Search header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Course Curriculum</h2>
            <span className="text-xs text-slate-400">({filteredLessons.length} available)</span>
          </div>

          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lessons..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Lessons List */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-400">Loading course curriculum...</p>
          </div>
        ) : filteredLessons.length === 0 ? (
          <div className="py-20 text-center bg-[#0d1527] border border-slate-800/80 rounded-2xl p-8">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-200">
              {searchQuery ? 'No matching lessons found' : 'No lessons published yet'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'Try a different search term or clear the search filter.'
                : 'The instructor is finalizing the Digital Marketing lessons. Please check back shortly.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLessons.map((lesson, index) => {
              const isCompleted = completedLessonIds.includes(lesson.id);
              const driveFileId = lesson.driveFileId;
              const thumbnailUrl = driveFileId ? getDriveThumbnailUrl(driveFileId) : null;

              return (
                <div
                  key={lesson.id}
                  onClick={() => setActiveLesson(lesson)}
                  className="group relative bg-[#0d162a] border border-slate-800/90 hover:border-blue-500/50 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-blue-900/20 transition-all duration-200 flex flex-col cursor-pointer"
                >
                  {/* Thumbnail / Header Preview */}
                  <div className="relative aspect-video bg-slate-950 overflow-hidden">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={lesson.title}
                        onError={(e) => {
                          // Fallback if Google Drive thumbnail blocked by browser
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80 group-hover:opacity-100"
                      />
                    ) : null}

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d162a] via-[#0d162a]/40 to-transparent" />

                    {/* Lesson index badge */}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-bold text-white shadow">
                      Lesson {String(lesson.order).padStart(2, '0')}
                    </div>

                    {/* Duration badge */}
                    {lesson.duration && (
                      <div className="absolute bottom-3 right-3 flex items-center space-x-1 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-semibold text-slate-300">
                        <Clock className="w-3 h-3" />
                        <span>{lesson.duration}</span>
                      </div>
                    )}

                    {/* Centered Play Button on hover */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-13 h-13 rounded-2xl bg-blue-600/90 text-white flex items-center justify-center shadow-lg shadow-blue-950/80 group-hover:scale-110 group-hover:bg-blue-500 transition-all">
                        <Play className="w-6 h-6 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                        <span className="font-semibold text-blue-400 uppercase tracking-wider text-[10px]">
                          Digital Marketing
                        </span>
                        {isCompleted && (
                          <span className="flex items-center space-x-1 text-emerald-400 text-[11px] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Watched</span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                        {lesson.title}
                      </h3>

                      {lesson.description && (
                        <p className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {lesson.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom action button */}
                    <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={(e) => toggleLessonCompleted(lesson.id, e)}
                        className={`text-xs flex items-center space-x-1.5 font-medium transition-colors ${
                          isCompleted ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title={isCompleted ? 'Mark as unwatched' : 'Mark as watched'}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isCompleted ? 'Completed' : 'Mark watched'}</span>
                      </button>

                      <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-900/40 transition-colors">
                        <span>Watch Video</span>
                        <Play className="w-3 h-3 fill-white" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* VIDEO PLAYER MODAL / THEATER */}
      {activeLesson && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-[#0a0f1d] border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden relative">
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#0e162b]">
              <div className="flex items-center space-x-3 overflow-hidden pr-4">
                <span className="px-2.5 py-1 rounded bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-bold shrink-0">
                  Lesson {String(activeLesson.order).padStart(2, '0')}
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  {activeLesson.title}
                </h3>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleLessonCompleted(activeLesson.id)}
                  className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    completedLessonIds.includes(activeLesson.id)
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{completedLessonIds.includes(activeLesson.id) ? 'Watched' : 'Mark as Watched'}</span>
                </button>

                <button
                  onClick={() => setActiveLesson(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Close player (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Video Player (Google Drive Embedded Preview Link) */}
            <div className="relative aspect-video-container bg-black w-full">
              <iframe
                src={getDrivePreviewUrl(activeLesson.driveFileId)}
                title={activeLesson.title}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>

            {/* Modal Footer Controls */}
            <div className="px-5 sm:px-6 py-4 bg-[#0a0f1d] border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-400 max-w-xl">
                {activeLesson.description ? (
                  <p className="line-clamp-2">{activeLesson.description}</p>
                ) : (
                  <p>Streaming directly from secure Google Drive link.</p>
                )}
              </div>

              {/* Prev / Next navigation */}
              <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                <button
                  onClick={handlePrevLesson}
                  disabled={currentActiveIndex <= 0}
                  className="flex items-center space-x-1 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <button
                  onClick={handleNextLesson}
                  disabled={currentActiveIndex >= lessons.length - 1}
                  className="flex items-center space-x-1 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-md shadow-blue-900/30"
                >
                  <span>Next Lesson</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
