import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp,
  increment,
  onSnapshot
} from 'firebase/firestore';
import { 
  BookOpen, 
  Users, 
  FileText, 
  Settings, 
  LogOut, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Search, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  Download, 
  Key,
  Menu,
  X,
  User,
  School,
  GraduationCap,
  ChevronRight,
  Sparkles,
  BrainCircuit,
  Loader2
} from 'lucide-react';

// --- Firebase Configuration ---{
  apiKey: "AIzaSyCwnewGU9ZPCUUYv7Yj5z7d0ZJdJSMAt2s",
  authDomain: "ifedowin-cbt.firebaseapp.com",
  projectId: "ifedowin-cbt",
  storageBucket: "ifedowin-cbt.firebasestorage.app",
  messagingSenderId: "944145654240",
  appId: "1:944145654240:web:3d37e359f7e204db93cb85",
  measurementId: "G-EBJ1NN7KTK"
};

// --- Types ---
type UserRole = 'guest' | 'admin' | 'student';

interface Student {
  id: string;
  fullName: string;
  examNumber: string;
  classId: string;
  subjects: string[]; // Array of subject IDs
}

interface ClassGroup {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
  classId: string;
}

interface Question {
  id: string;
  classId: string;
  subjectId: string;
  text: string;
  image?: string;
  options: { [key: string]: string }; // A, B, C, D
  correctOption: string;
}

interface Exam {
  id: string;
  classId: string;
  subjectId: string;
  duration: number; // minutes
  startTime: string; // ISO string
  endTime: string;
  active: boolean;
  instruction: string;
}

interface Result {
  id: string;
  studentId: string;
  examId: string;
  subjectId: string;
  score: number;
  totalQuestions: number;
  answers: { [qId: string]: string };
  timestamp: any;
}

interface Pin {
  id: string;
  code: string;
  studentId?: string; // Optional until used or assigned
  usageCount: number;
  maxUses: number;
  createdAt: any;
}

interface SiteSettings {
  welcomeMessage: string;
  examInstructions: string;
  resultInstructions: string;
  footerText: string;
  adminName: string;
  adminMessage: string;
  schoolName: string;
  themeColor: string;
}

// --- Constants ---
const LOGO_URL = "1757768417014-removebg-preview.png";
const COLLECTION_PREFIX = 'ifedowin_cbt_v1'; 

// --- Components ---

// 1. Layout & Utilities
const Container = ({ children, className = "" }) => (
  <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
);

const Button = ({ onClick, children, variant = 'primary', className = "", disabled = false }) => {
  const baseStyle = "px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center";
  const variants = {
    primary: "bg-blue-700 text-white hover:bg-blue-800 focus:ring-blue-500",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50",
    magic: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-md"
  };
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }) => (
  <div className={`bg-white shadow-md rounded-lg p-6 ${className}`}>{children}</div>
);

// --- Main Application Component ---

export default function IfedowinCBT() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>('guest');
  const [currentView, setCurrentView] = useState('home'); // home, admin_login, student_login, admin_dashboard, student_dashboard, exam_interface, result_portal
  const [settings, setSettings] = useState<SiteSettings>({
    welcomeMessage: "Welcome to Ifedowin Excellent Schools CBT Platform. Excellence is our watchword.",
    examInstructions: "Please read the questions carefully. Do not refresh the page.",
    resultInstructions: "Enter your Exam Number and Scratch Card PIN to view results.",
    footerText: "© 2025 Ifedowin Excellent Schools. All Rights Reserved.",
    adminName: "Principal",
    adminMessage: "We wish you the best of luck in your examinations.",
    schoolName: "IFEDOWIN EXCELLENT SCHOOLS",
    themeColor: "blue"
  });
  
  // Admin State
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  
  // Data Helpers
  const getColl = (name: string) => collection(db, 'artifacts', appId, 'public', 'data', `${COLLECTION_PREFIX}_${name}`);

  // --- Initialization ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) fetchSettings();
    });
    return () => unsubscribe();
  }, []);

  const fetchSettings = async () => {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(getColl('settings'), 'general_settings');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setSettings(snap.data() as SiteSettings);
      } else {
        // Initialize default settings if not exists
        await setDoc(docRef, settings);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching settings:", error);
      setLoading(false);
    }
  };

  // --- Navigation Handlers ---
  const handleLoginSuccess = (userRole: UserRole, studentData?: Student) => {
    setRole(userRole);
    if (userRole === 'student' && studentData) {
      setActiveStudent(studentData);
      setCurrentView('student_dashboard');
    } else if (userRole === 'admin') {
      setCurrentView('admin_dashboard');
    }
  };

  const handleLogout = () => {
    setRole('guest');
    setActiveStudent(null);
    setCurrentView('home');
  };

  // --- Render ---
  if (loading) return <div className="flex items-center justify-center h-screen text-blue-700">Loading IFEDOWIN CBT...</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-blue-900 text-white shadow-lg">
        <Container className="py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('home')}>
            <img src={LOGO_URL} alt="Logo" className="h-12 w-auto bg-white rounded-full p-1" />
            <div>
              <h1 className="text-lg font-bold leading-tight">{settings.schoolName}</h1>
              <p className="text-xs text-blue-200">CBT & Result Portal</p>
            </div>
          </div>
          <nav className="flex items-center space-x-4">
            {role === 'guest' && (
              <>
                <button onClick={() => setCurrentView('home')} className="hover:text-blue-200">Home</button>
                <button onClick={() => setCurrentView('result_portal')} className="hover:text-blue-200">Check Result</button>
              </>
            )}
            {role !== 'guest' && (
              <div className="flex items-center space-x-3">
                <span className="text-sm hidden md:inline">
                  {role === 'admin' ? 'Administrator' : activeStudent?.fullName}
                </span>
                <button onClick={handleLogout} className="flex items-center bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm">
                  <LogOut className="w-4 h-4 mr-1" /> Logout
                </button>
              </div>
            )}
          </nav>
        </Container>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {currentView === 'home' && (
          <HomeView 
            settings={settings} 
            onAdminClick={() => setCurrentView('admin_login')}
            onStudentClick={() => setCurrentView('student_login')}
            onCheckResultClick={() => setCurrentView('result_portal')}
          />
        )}
        
        {currentView === 'admin_login' && <AdminLogin onLogin={() => handleLoginSuccess('admin')} onCancel={() => setCurrentView('home')} />}
        
        {currentView === 'student_login' && <StudentLogin onLogin={(s) => handleLoginSuccess('student', s)} onCancel={() => setCurrentView('home')} getColl={getColl} />}
        
        {currentView === 'admin_dashboard' && <AdminDashboard getColl={getColl} settings={settings} setSettings={setSettings} />}
        
        {currentView === 'student_dashboard' && activeStudent && <StudentDashboard student={activeStudent} getColl={getColl} onStartExam={(examId) => setCurrentView(`exam_${examId}`)} />}
        
        {currentView.startsWith('exam_') && activeStudent && (
          <ExamInterface 
            examId={currentView.split('_')[1]} 
            student={activeStudent} 
            getColl={getColl} 
            settings={settings}
            onFinish={() => setCurrentView('student_dashboard')} 
          />
        )}

        {currentView === 'result_portal' && <ResultPortal getColl={getColl} settings={settings} />}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-6 border-t border-gray-800">
        <Container className="text-center">
          <p>{settings.footerText}</p>
          <p className="text-xs mt-2 text-gray-600">Powered by Create.xyz</p>
        </Container>
      </footer>
    </div>
  );
}

// --- Sub-Components ---

function HomeView({ settings, onAdminClick, onStudentClick, onCheckResultClick }) {
  return (
    <div className="relative">
      <div className="bg-blue-800 text-white py-16 text-center px-4">
        <img src={LOGO_URL} className="w-24 h-24 mx-auto mb-4 bg-white rounded-full p-2 shadow-lg" />
        <h2 className="text-3xl font-bold mb-4">Welcome to {settings.schoolName}</h2>
        <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-8 whitespace-pre-wrap">{settings.welcomeMessage}</p>
        
        <div className="flex flex-wrap justify-center gap-4">
          <button onClick={onStudentClick} className="bg-white text-blue-900 px-6 py-3 rounded-lg font-bold shadow hover:bg-blue-50 transition flex items-center">
            <BookOpen className="mr-2" /> Write Exam
          </button>
          <button onClick={onCheckResultClick} className="bg-green-500 text-white px-6 py-3 rounded-lg font-bold shadow hover:bg-green-600 transition flex items-center">
            <CheckCircle className="mr-2" /> Check Result
          </button>
        </div>
      </div>

      <Container className="py-12 grid md:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
          <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
            <Users />
          </div>
          <h3 className="font-bold text-lg mb-2">Student Login</h3>
          <p className="text-gray-600 mb-4">Access your CBT exams using your unique Exam Number assigned by the school.</p>
          <button onClick={onStudentClick} className="text-blue-600 font-semibold hover:underline">Login to Exam &rarr;</button>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
          <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
            <FileText />
          </div>
          <h3 className="font-bold text-lg mb-2">Check Results</h3>
          <p className="text-gray-600 mb-4">Use your scratch card PIN to access your full term academic results and print them.</p>
          <button onClick={onCheckResultClick} className="text-green-600 font-semibold hover:underline">Check Now &rarr;</button>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
          <div className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-600">
            <Settings />
          </div>
          <h3 className="font-bold text-lg mb-2">Admin Portal</h3>
          <p className="text-gray-600 mb-4">Secure area for teachers and administrators to manage exams and records.</p>
          <button onClick={onAdminClick} className="text-gray-600 font-semibold hover:underline">Admin Login &rarr;</button>
        </div>
      </Container>
    </div>
  );
}

function AdminLogin({ onLogin, onCancel }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Hardcoded for demo, in real app use Firebase Auth or Firestore check
    if (username === 'admin' && password === 'admin123') {
      onLogin();
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <Container className="py-12 flex justify-center">
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-blue-900">Admin Login</h2>
          <p className="text-gray-500">Enter your credentials to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input 
              type="text" 
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input 
              type="password" 
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <div className="flex space-x-3">
            <Button onClick={onCancel} variant="secondary" className="w-1/3">Cancel</Button>
            <Button onClick={handleSubmit} className="w-2/3">Login</Button>
          </div>
        </form>
      </Card>
    </Container>
  );
}

function StudentLogin({ onLogin, onCancel, getColl }) {
  const [examNumber, setExamNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const q = query(getColl('students'), where('examNumber', '==', examNumber));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const studentDoc = querySnapshot.docs[0];
        onLogin({ id: studentDoc.id, ...studentDoc.data() } as Student);
      } else {
        setError('Exam Number not found. Please contact admin.');
      }
    } catch (err) {
      console.error(err);
      setError('System error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="py-12 flex justify-center">
      <Card className="w-full max-w-md text-center">
        <div className="mb-6">
           <img src={LOGO_URL} className="h-16 w-auto mx-auto mb-4" />
           <h2 className="text-2xl font-bold text-blue-900">Student Exam Login</h2>
           <p className="text-gray-500">Enter your unique Exam Number</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input 
            type="text" 
            placeholder="e.g., IF/2025/001"
            className="block w-full text-center text-xl tracking-widest border-2 border-blue-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 uppercase"
            value={examNumber}
            onChange={(e) => setExamNumber(e.target.value.toUpperCase())}
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button onClick={handleSubmit} disabled={loading} className="w-full py-3 text-lg">
            {loading ? 'Verifying...' : 'Start Exam Session'}
          </Button>
          <button type="button" onClick={onCancel} className="text-gray-500 text-sm hover:underline">Back to Home</button>
        </form>
      </Card>
    </Container>
  );
}

// --- Admin Dashboard & Modules ---

function AdminDashboard({ getColl, settings, setSettings }) {
  const [activeTab, setActiveTab] = useState('students'); // students, classes, subjects, questions, exams, pins, results, settings

  const renderTab = () => {
    switch(activeTab) {
      case 'students': return <AdminStudents getColl={getColl} />;
      case 'classes': return <AdminClasses getColl={getColl} />;
      case 'subjects': return <AdminSubjects getColl={getColl} />;
      case 'questions': return <AdminQuestions getColl={getColl} />;
      case 'exams': return <AdminExams getColl={getColl} />;
      case 'pins': return <AdminPins getColl={getColl} />;
      case 'results': return <AdminResults getColl={getColl} />;
      case 'settings': return <AdminSettings getColl={getColl} settings={settings} onUpdate={setSettings} />;
      default: return <div>Select a module</div>;
    }
  };

  const tabs = [
    { id: 'students', label: 'Students', icon: Users },
    { id: 'classes', label: 'Classes', icon: School },
    { id: 'subjects', label: 'Subjects', icon: BookOpen },
    { id: 'questions', label: 'Question Bank', icon: FileText },
    { id: 'exams', label: 'Exams', icon: Clock },
    { id: 'pins', label: 'PINs', icon: Key },
    { id: 'results', label: 'Results', icon: GraduationCap },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-[600px] bg-white">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-gray-800 text-gray-100 flex-shrink-0">
        <div className="p-4 font-bold text-gray-400 uppercase text-xs tracking-wider">Management Console</div>
        <nav className="space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-blue-700 text-white' : 'hover:bg-gray-700'}`}
            >
              <tab.icon className="mr-3 h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      {/* Content Area */}
      <div className="flex-1 p-6 overflow-auto bg-gray-50">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2 capitalize">{activeTab.replace('_', ' ')} Management</h2>
        {renderTab()}
      </div>
    </div>
  );
}

// -- Admin Modules --

function AdminClasses({ getColl }) {
  const [classes, setClasses] = useState<any[]>([]);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(getColl('classes'), (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const addClass = async () => {
    if (!newName) return;
    await addDoc(getColl('classes'), { name: newName });
    setNewName('');
  };

  return (
    <div className="max-w-2xl">
      <div className="flex gap-2 mb-6">
        <input 
          className="border p-2 rounded flex-1" 
          placeholder="New Class Name (e.g. JSS 1)"
          value={newName}
          onChange={e => setNewName(e.target.value)} 
        />
        <Button onClick={addClass}>Add Class</Button>
      </div>
      <div className="space-y-2">
        {classes.map(c => (
          <div key={c.id} className="bg-white p-3 rounded shadow flex justify-between items-center">
            <span className="font-medium">{c.name}</span>
            <button className="text-red-500" onClick={() => deleteDoc(doc(getColl('classes'), c.id))}><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminSubjects({ getColl }) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [newSub, setNewSub] = useState({ name: '', classId: '' });

  useEffect(() => {
    const u1 = onSnapshot(getColl('subjects'), s => setSubjects(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(getColl('classes'), s => setClasses(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  const addSubject = async () => {
    if (!newSub.name || !newSub.classId) return;
    await addDoc(getColl('subjects'), newSub);
    setNewSub({ ...newSub, name: '' });
  };

  const getClassName = (id) => classes.find(c => c.id === id)?.name || 'Unknown';

  return (
    <div className="max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6 bg-white p-4 rounded shadow-sm">
        <select 
          className="border p-2 rounded"
          value={newSub.classId}
          onChange={e => setNewSub({...newSub, classId: e.target.value})}
        >
          <option value="">Select Class</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input 
          className="border p-2 rounded" 
          placeholder="Subject Name (e.g. Mathematics)"
          value={newSub.name}
          onChange={e => setNewSub({...newSub, name: e.target.value})} 
        />
        <Button onClick={addSubject}>Add Subject</Button>
      </div>
      <div className="space-y-2">
        {subjects.map(s => (
          <div key={s.id} className="bg-white p-3 rounded shadow flex justify-between items-center">
            <div>
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-gray-500 ml-2 bg-gray-100 px-2 py-1 rounded">{getClassName(s.classId)}</span>
            </div>
            <button className="text-red-500" onClick={() => deleteDoc(doc(getColl('subjects'), s.id))}><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminStudents({ getColl }) {
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<Student>>({ fullName: '', examNumber: '', classId: '', subjects: [] });

  useEffect(() => {
    const u1 = onSnapshot(getColl('students'), s => setStudents(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(getColl('classes'), s => setClasses(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(getColl('subjects'), s => setSubjects(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); };
  }, []);

  const saveStudent = async () => {
    if (!formData.fullName || !formData.examNumber || !formData.classId) return;
    
    // Auto-assign subjects for the class if empty (Optional helper)
    let finalSubjects = formData.subjects || [];
    if (finalSubjects.length === 0) {
      finalSubjects = subjects.filter(s => s.classId === formData.classId).map(s => s.id);
    }

    await addDoc(getColl('students'), { ...formData, subjects: finalSubjects });
    setIsAdding(false);
    setFormData({ fullName: '', examNumber: '', classId: '', subjects: [] });
  };

  const downloadCSV = () => {
    const headers = "Full Name,Exam Number,Class,Subject Count\n";
    const rows = students.map(s => {
      const cName = classes.find(c => c.id === s.classId)?.name || 'N/A';
      return `"${s.fullName}","${s.examNumber}","${cName}",${s.subjects?.length || 0}`;
    }).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_list.csv';
    a.click();
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <Button onClick={() => setIsAdding(!isAdding)}>{isAdding ? 'Cancel' : 'Add New Student'}</Button>
        <Button variant="outline" onClick={downloadCSV}><Download className="w-4 h-4 mr-2 inline" /> Export CSV</Button>
      </div>

      {isAdding && (
        <Card className="mb-6 bg-blue-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="border p-2 rounded" placeholder="Full Name" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
            <input className="border p-2 rounded uppercase" placeholder="Exam Number (Unique)" value={formData.examNumber} onChange={e => setFormData({...formData, examNumber: e.target.value.toUpperCase()})} />
            <select className="border p-2 rounded" value={formData.classId} onChange={e => setFormData({...formData, classId: e.target.value})}>
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">All subjects in selected class will be assigned automatically.</p>
            <Button onClick={saveStudent}>Save Student</Button>
          </div>
        </Card>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {students.map(student => {
             const cName = classes.find(c => c.id === student.classId)?.name || 'Unknown';
             return (
              <li key={student.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-blue-600 truncate">{student.fullName}</p>
                  <p className="text-sm text-gray-500">{student.examNumber} • {cName}</p>
                </div>
                <button className="text-red-400 hover:text-red-600" onClick={() => deleteDoc(doc(getColl('students'), student.id))}>
                  <Trash2 className="h-5 w-5" />
                </button>
              </li>
             );
          })}
        </ul>
      </div>
    </div>
  );
}

function AdminQuestions({ getColl }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [filterSub, setFilterSub] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [qData, setQData] = useState<Partial<Question>>({ 
    text: '', 
    options: { A: '', B: '', C: '', D: '' }, 
    correctOption: 'A',
    classId: '',
    subjectId: ''
  });

  useEffect(() => {
    const u1 = onSnapshot(getColl('subjects'), s => setSubjects(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    let q = query(getColl('questions'));
    if (filterSub) {
      q = query(getColl('questions'), where('subjectId', '==', filterSub));
    }
    const u2 = onSnapshot(q, s => setQuestions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    return () => { u1(); u2(); };
  }, [filterSub]);

  const handleSubChange = (subId) => {
    const sub = subjects.find(s => s.id === subId);
    setQData({ ...qData, subjectId: subId, classId: sub?.classId || '' });
  };

  const saveQuestion = async (data = qData) => {
    if (!data.text || !data.subjectId) return;
    await addDoc(getColl('questions'), data);
    if (!showAiModal) { // Only reset if manual
      setIsAdding(false);
      setQData({ 
        text: '', 
        options: { A: '', B: '', C: '', D: '' }, 
        correctOption: 'A', 
        classId: qData.classId, 
        subjectId: qData.subjectId 
      });
    }
  };

  const generateAIQuestions = async () => {
    if (!aiTopic || !qData.subjectId) {
      alert("Please select a subject and enter a topic.");
      return;
    }
    setIsGenerating(true);
    
    try {
      const selectedSubject = subjects.find(s => s.id === qData.subjectId);
      const prompt = `Generate 3 multiple choice questions about "${aiTopic}" for a ${selectedSubject?.name} exam. 
      Return ONLY a JSON array of objects. Each object must have:
      - "text": string (the question)
      - "options": object with keys A, B, C, D
      - "correctOption": string (one of A, B, C, D)
      Do not use markdown code blocks. Just return the raw JSON string.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      // Clean up markdown if present
      const jsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const generatedQs = JSON.parse(jsonText);

      // Batch add
      for (const gq of generatedQs) {
        await saveQuestion({
          ...gq,
          classId: selectedSubject?.classId || '',
          subjectId: qData.subjectId
        });
      }
      
      setShowAiModal(false);
      setAiTopic('');
      alert(`Successfully generated ${generatedQs.length} questions!`);

    } catch (error) {
      console.error("AI Error:", error);
      alert("Failed to generate questions. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <div className="flex gap-4 mb-6 bg-white p-4 rounded shadow">
        <select className="border p-2 rounded flex-1" value={filterSub} onChange={e => setFilterSub(e.target.value)}>
          <option value="">All Subjects</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Button variant="magic" onClick={() => setShowAiModal(true)}>
          <Sparkles className="w-4 h-4 mr-2" /> AI Generate
        </Button>
        <Button onClick={() => setIsAdding(!isAdding)}>{isAdding ? 'Cancel' : 'Add Question'}</Button>
      </div>

      {/* AI Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center text-indigo-600">
                <BrainCircuit className="w-6 h-6 mr-2" /> AI Question Generator
              </h3>
              <button onClick={() => setShowAiModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
               <select 
                 className="w-full border p-3 rounded-lg" 
                 value={qData.subjectId} 
                 onChange={e => handleSubChange(e.target.value)}
               >
                 <option value="">Select Subject</option>
                 {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
               <input 
                 className="w-full border p-3 rounded-lg" 
                 placeholder="Enter Topic (e.g., Photosynthesis, Algebra, World War II)" 
                 value={aiTopic}
                 onChange={e => setAiTopic(e.target.value)}
               />
               <div className="bg-indigo-50 p-3 rounded text-sm text-indigo-800">
                 This will generate 3 unique multiple-choice questions based on your topic and automatically add them to the question bank.
               </div>
               <Button 
                 onClick={generateAIQuestions} 
                 variant="magic" 
                 className="w-full py-3 text-lg"
                 disabled={isGenerating}
               >
                 {isGenerating ? (
                   <span className="flex items-center"><Loader2 className="w-5 h-5 mr-2 animate-spin"/> Generating...</span>
                 ) : (
                   "✨ Generate & Save"
                 )}
               </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Form */}
      {isAdding && (
        <Card className="mb-6 border-l-4 border-blue-500">
           <div className="space-y-4">
             {!filterSub && (
               <select className="w-full border p-2 rounded" value={qData.subjectId} onChange={e => handleSubChange(e.target.value)}>
                 <option value="">Select Subject</option>
                 {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
             )}
             <textarea 
               className="w-full border p-2 rounded h-24" 
               placeholder="Question Text"
               value={qData.text}
               onChange={e => setQData({...qData, text: e.target.value})}
             />
             <div className="grid grid-cols-2 gap-4">
               {['A', 'B', 'C', 'D'].map(opt => (
                 <div key={opt} className="flex items-center">
                   <span className="w-8 font-bold">{opt}</span>
                   <input 
                     className="flex-1 border p-2 rounded"
                     placeholder={`Option ${opt}`}
                     value={qData.options?.[opt] || ''}
                     onChange={e => setQData({ ...qData, options: { ...qData.options, [opt]: e.target.value } as any })}
                   />
                 </div>
               ))}
             </div>
             <div className="flex items-center gap-4">
               <span className="font-bold">Correct Answer:</span>
               <select 
                  className="border p-2 rounded bg-green-50"
                  value={qData.correctOption}
                  onChange={e => setQData({...qData, correctOption: e.target.value})}
                >
                  {['A', 'B', 'C', 'D'].map(o => <option key={o} value={o}>{o}</option>)}
               </select>
             </div>
             <Button onClick={() => saveQuestion()}>Save to Question Bank</Button>
           </div>
        </Card>
      )}

      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-white p-4 rounded shadow">
            <div className="flex justify-between items-start">
               <div>
                 <span className="text-xs font-bold text-gray-400 mb-1 block">Q{i+1}</span>
                 <p className="font-medium mb-2">{q.text}</p>
                 <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-600">
                   {Object.entries(q.options).map(([k, v]) => (
                     <span key={k} className={k === q.correctOption ? "text-green-600 font-bold" : ""}>{k}. {v as string}</span>
                   ))}
                 </div>
               </div>
               <button className="text-red-400" onClick={() => deleteDoc(doc(getColl('questions'), q.id))}><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminExams({ getColl }) {
  const [exams, setExams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<Exam>>({
    duration: 40,
    active: true,
    instruction: "Attempt all questions.",
    subjectId: ''
  });

  useEffect(() => {
    const u1 = onSnapshot(getColl('exams'), s => setExams(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(getColl('subjects'), s => setSubjects(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  const saveExam = async () => {
    if (!formData.subjectId) return;
    const sub = subjects.find(s => s.id === formData.subjectId);
    await addDoc(getColl('exams'), { ...formData, classId: sub?.classId, startTime: new Date().toISOString() });
    setIsAdding(false);
  };

  const toggleActive = async (exam) => {
    await updateDoc(doc(getColl('exams'), exam.id), { active: !exam.active });
  };

  return (
    <div>
      <Button onClick={() => setIsAdding(!isAdding)} className="mb-6">{isAdding ? 'Cancel' : 'Create New Exam'}</Button>

      {isAdding && (
        <Card className="mb-6">
          <div className="space-y-4">
             <select className="w-full border p-2 rounded" value={formData.subjectId} onChange={e => setFormData({...formData, subjectId: e.target.value})}>
                 <option value="">Select Subject for Exam</option>
                 {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
             <div className="flex gap-4">
               <div className="flex-1">
                 <label className="text-xs text-gray-500 block">Duration (Minutes)</label>
                 <input type="number" className="w-full border p-2 rounded" value={formData.duration} onChange={e => setFormData({...formData, duration: parseInt(e.target.value)})} />
               </div>
             </div>
             <textarea className="w-full border p-2 rounded" placeholder="Exam Instructions" value={formData.instruction} onChange={e => setFormData({...formData, instruction: e.target.value})} />
             <Button onClick={saveExam}>Publish Exam</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4">
        {exams.map(exam => {
          const sub = subjects.find(s => s.id === exam.subjectId);
          return (
            <div key={exam.id} className="bg-white p-4 rounded shadow border-l-4 border-blue-600 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{sub?.name || 'Unknown Subject'}</h3>
                <p className="text-sm text-gray-600">{exam.duration} mins • {exam.active ? <span className="text-green-600">Active</span> : <span className="text-red-500">Closed</span>}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => toggleActive(exam)}
                  className={`px-3 py-1 rounded text-sm ${exam.active ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}
                >
                  {exam.active ? 'Close Exam' : 'Re-open'}
                </button>
                <button onClick={() => deleteDoc(doc(getColl('exams'), exam.id))} className="text-red-500 bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminPins({ getColl }) {
  const [pins, setPins] = useState<any[]>([]);
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const u = onSnapshot(query(getColl('pins')), s => setPins(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => u();
  }, []);

  const generatePins = async () => {
    setLoading(true);
    const batch = [];
    for(let i=0; i<amount; i++) {
      const code = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      await addDoc(getColl('pins'), {
        code,
        usageCount: 0,
        maxUses: 3,
        createdAt: serverTimestamp(),
        studentId: null
      });
    }
    setLoading(false);
  };

  const downloadPins = () => {
    const txt = pins.map(p => `PIN: ${p.code} | Uses: ${p.usageCount}/3`).join('\n');
    const blob = new Blob([txt], {type: 'text/plain'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated_pins.txt';
    a.click();
  };

  return (
    <div>
      <div className="bg-white p-6 rounded shadow mb-6">
        <h3 className="font-bold mb-4">PIN Generator</h3>
        <div className="flex gap-4 items-center">
          <input type="number" className="border p-2 rounded w-24" value={amount} onChange={e => setAmount(parseInt(e.target.value))} />
          <Button onClick={generatePins} disabled={loading}>{loading ? 'Generating...' : `Generate ${amount} PINs`}</Button>
          <Button variant="outline" onClick={downloadPins}>Export List</Button>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden rounded-md">
        <div className="p-4 border-b bg-gray-50 font-bold grid grid-cols-3">
           <span>PIN Code</span>
           <span>Usage</span>
           <span>Action</span>
        </div>
        <div className="divide-y max-h-96 overflow-auto">
          {pins.map(p => (
            <div key={p.id} className="p-4 grid grid-cols-3 items-center text-sm">
              <span className="font-mono font-medium tracking-wider">{p.code}</span>
              <span>
                <span className={`px-2 py-1 rounded ${p.usageCount >= p.maxUses ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  {p.usageCount} / {p.maxUses}
                </span>
              </span>
              <button className="text-red-500 text-left" onClick={() => deleteDoc(doc(getColl('pins'), p.id))}><Trash2 size={14}/></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminSettings({ getColl, settings, onUpdate }) {
  const [local, setLocal] = useState(settings);

  const save = async () => {
    await updateDoc(doc(getColl('settings'), 'general_settings'), local);
    onUpdate(local);
    alert('Settings saved!');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <h3 className="font-bold mb-4">General Announcements</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600">Welcome Message</label>
            <textarea className="w-full border p-2 rounded h-24" value={local.welcomeMessage} onChange={e => setLocal({...local, welcomeMessage: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Exam Instructions</label>
            <textarea className="w-full border p-2 rounded" value={local.examInstructions} onChange={e => setLocal({...local, examInstructions: e.target.value})} />
          </div>
           <div>
            <label className="block text-sm text-gray-600">Result Page Instructions</label>
            <textarea className="w-full border p-2 rounded" value={local.resultInstructions} onChange={e => setLocal({...local, resultInstructions: e.target.value})} />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-bold mb-4">Administrator & Footer</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
            <label className="block text-sm text-gray-600">Admin Name</label>
            <input className="w-full border p-2 rounded" value={local.adminName} onChange={e => setLocal({...local, adminName: e.target.value})} />
          </div>
           <div>
            <label className="block text-sm text-gray-600">Footer Text</label>
            <input className="w-full border p-2 rounded" value={local.footerText} onChange={e => setLocal({...local, footerText: e.target.value})} />
          </div>
          <div className="col-span-2">
             <label className="block text-sm text-gray-600">Admin Message (Signature)</label>
             <textarea className="w-full border p-2 rounded" value={local.adminMessage} onChange={e => setLocal({...local, adminMessage: e.target.value})} />
          </div>
        </div>
      </Card>
      <Button onClick={save} className="w-full md:w-auto">Save All Changes</Button>
    </div>
  );
}

function AdminResults({ getColl }) {
    // Simplified result viewer
    const [results, setResults] = useState<any[]>([]);
    useEffect(() => {
        // Only grab last 50 for perf in demo
        const q = query(getColl('results')); // In real app, use limit/order
        const u = onSnapshot(q, s => setResults(s.docs.map(d => d.data())));
        return () => u();
    }, []);

    const downloadCSV = () => {
        const headers = "ExamID,StudentID,Score,Total\n";
        const rows = results.map(r => `${r.examId},${r.studentId},${r.score},${r.totalQuestions}`).join('\n');
        const blob = new Blob([headers + rows], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'all_results.csv';
        a.click();
    }

    return (
        <Card>
            <div className="flex justify-between mb-4">
                <h3 className="font-bold">Result Database</h3>
                <Button variant="outline" onClick={downloadCSV}>Export Results CSV</Button>
            </div>
            <div className="max-h-96 overflow-auto text-sm">
                <table className="w-full text-left">
                    <thead className="bg-gray-100"><tr><th className="p-2">Student ID</th><th className="p-2">Score</th></tr></thead>
                    <tbody>
                        {results.map((r,i) => (
                            <tr key={i} className="border-b"><td className="p-2">{r.studentId}</td><td className="p-2">{r.score}/{r.totalQuestions}</td></tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    )
}

// --- Student Dashboard & Exam ---

function StudentDashboard({ student, getColl, onStartExam }) {
  const [activeExams, setActiveExams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    const q = query(getColl('exams'), where('active', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      // Filter active exams that match student's subjects
      const allActive = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const myExams = allActive.filter(ex => student.subjects?.includes((ex as any).subjectId));
      setActiveExams(myExams);
    });
    
    const unsub2 = onSnapshot(getColl('subjects'), s => setSubjects(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsub(); unsub2(); };
  }, [student]);

  return (
    <Container className="py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">Welcome, {student.fullName}</h2>
            <p className="text-gray-600">{student.examNumber}</p>
        </div>
        <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-semibold">
            {activeExams.length} Exam(s) Available
        </div>
      </div>

      {activeExams.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
            <div className="text-gray-400 text-6xl mb-4">☕</div>
            <h3 className="text-xl font-medium text-gray-600">No active exams at the moment.</h3>
            <p className="text-gray-500">Please check back later or contact your teacher.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeExams.map(exam => {
                const sub = subjects.find(s => s.id === exam.subjectId);
                return (
                    <div key={exam.id} className="bg-white rounded-xl shadow-sm border-2 border-transparent hover:border-blue-500 transition overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded uppercase">CBT Exam</span>
                                <Clock className="w-5 h-5 text-gray-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{sub?.name}</h3>
                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{exam.instruction}</p>
                            <div className="flex items-center text-sm text-gray-500 mb-6">
                                <span className="flex items-center mr-4"><Clock className="w-4 h-4 mr-1" /> {exam.duration} Minutes</span>
                            </div>
                            <Button onClick={() => onStartExam(exam.id)} className="w-full">Start Exam</Button>
                        </div>
                    </div>
                );
            })}
        </div>
      )}
    </Container>
  );
}

function ExamInterface({ examId, student, getColl, settings, onFinish }) {
  const [exam, setExam] = useState<any>(null);
  const [subject, setSubject] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(0);
  
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const load = async () => {
      const examDoc = await getDoc(doc(getColl('exams'), examId));
      if (!examDoc.exists()) return;
      const exData = examDoc.data();
      setExam(exData);
      setTimeLeft(exData.duration * 60);

      const subDoc = await getDoc(doc(getColl('subjects'), exData.subjectId));
      setSubject(subDoc.data());

      // Fetch Questions for Subject
      const qQuery = query(getColl('questions'), where('subjectId', '==', exData.subjectId));
      const qSnap = await getDocs(qQuery);
      
      // Shuffle questions
      const rawQs = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuestions(rawQs.sort(() => 0.5 - Math.random()));
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (timeLeft > 0 && !loading) {
        timerRef.current = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0 && !loading) {
        submitExam();
    }
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, loading]);

  const handleSelect = (opt) => {
    setAnswers({ ...answers, [questions[currentQ].id]: opt });
  };

  const submitExam = async () => {
    setLoading(true);
    // Grading
    let score = 0;
    questions.forEach(q => {
        if (answers[q.id] === q.correctOption) score++;
    });

    // Save Result
    await addDoc(getColl('results'), {
        examId,
        studentId: student.id,
        subjectId: exam.subjectId,
        score,
        totalQuestions: questions.length,
        answers,
        timestamp: serverTimestamp()
    });

    alert(`Exam Submitted! Your score: ${score}/${questions.length}`);
    onFinish();
  };

  if (loading) return <div className="p-12 text-center">Loading Exam...</div>;

  const formatTime = (s) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const activeQ = questions[currentQ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
        {/* Exam Header */}
        <div className="bg-blue-900 text-white p-4 sticky top-0 z-10 shadow-md flex justify-between items-center">
            <div>
                <h3 className="font-bold text-lg">{subject?.name}</h3>
                <p className="text-xs opacity-75">Student: {student.fullName}</p>
            </div>
            <div className={`text-2xl font-mono font-bold ${timeLeft < 300 ? 'text-red-400 animate-pulse' : ''}`}>
                {formatTime(timeLeft)}
            </div>
        </div>

        <Container className="flex-grow py-8">
            {questions.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Question Area */}
                    <div className="lg:col-span-3">
                        <Card className="min-h-[400px] flex flex-col">
                            <div className="flex-grow">
                                <h4 className="text-gray-500 font-bold mb-4">Question {currentQ + 1} of {questions.length}</h4>
                                <p className="text-xl font-medium text-gray-900 mb-8 leading-relaxed">
                                    {activeQ.text}
                                </p>
                                <div className="space-y-3">
                                    {['A', 'B', 'C', 'D'].map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => handleSelect(opt)}
                                            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${answers[activeQ.id] === opt ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'}`}
                                        >
                                            <span className="font-bold mr-3 text-gray-500">{opt}.</span>
                                            {activeQ.options[opt]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-between mt-8 pt-4 border-t">
                                <Button variant="outline" onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}>Previous</Button>
                                {currentQ === questions.length - 1 ? (
                                    <Button variant="danger" onClick={() => { if(confirm('Submit Exam?')) submitExam(); }}>Submit Exam</Button>
                                ) : (
                                    <Button onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))}>Next Question <ChevronRight className="w-4 h-4 ml-1 inline" /></Button>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Navigator */}
                    <div className="lg:col-span-1">
                        <Card>
                           <h4 className="font-bold mb-4 text-sm text-gray-500">Question Navigator</h4>
                           <div className="grid grid-cols-5 gap-2">
                               {questions.map((q, idx) => (
                                   <button
                                     key={idx}
                                     onClick={() => setCurrentQ(idx)}
                                     className={`h-10 w-10 rounded flex items-center justify-center text-sm font-bold ${currentQ === idx ? 'ring-2 ring-blue-500 border-blue-500' : ''} ${answers[q.id] ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                                   >
                                       {idx + 1}
                                   </button>
                               ))}
                           </div>
                           <div className="mt-8 pt-4 border-t text-center">
                               <div className="text-xs text-gray-500 mb-2">Administrator Message</div>
                               <p className="text-sm italic text-gray-700">"{settings.adminMessage}"</p>
                           </div>
                        </Card>
                    </div>
                </div>
            ) : (
                <div className="text-center">No questions loaded for this exam.</div>
            )}
        </Container>
    </div>
  );
}

// --- Result Portal ---

function ResultPortal({ getColl, settings }) {
    const [step, setStep] = useState(1);
    const [examNum, setExamNum] = useState('');
    const [pinCode, setPinCode] = useState('');
    const [resultData, setResultData] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [aiInsight, setAiInsight] = useState('');
    const [loadingInsight, setLoadingInsight] = useState(false);

    const checkResult = async () => {
        setLoading(true);
        setError('');
        try {
            // 1. Validate Student
            const sQ = query(getColl('students'), where('examNumber', '==', examNum));
            const sSnap = await getDocs(sQ);
            if(sSnap.empty) throw new Error("Student not found");
            const student = { id: sSnap.docs[0].id, ...sSnap.docs[0].data() };

            // 2. Validate PIN
            const pQ = query(getColl('pins'), where('code', '==', pinCode));
            const pSnap = await getDocs(pQ);
            if(pSnap.empty) throw new Error("Invalid PIN");
            const pinDoc = pSnap.docs[0];
            const pinData = pinDoc.data() as Pin;

            if(pinData.usageCount >= pinData.maxUses) throw new Error("PIN Usage Exhausted");
            if(pinData.studentId && pinData.studentId !== student.id) throw new Error("PIN is locked to another student");

            // 3. Fetch Results
            const rQ = query(getColl('results'), where('studentId', '==', student.id));
            const rSnap = await getDocs(rQ);
            const results = rSnap.docs.map(d => d.data());

            if(results.length === 0) throw new Error("No results found for this student yet.");

            // 4. Update PIN & Show
            await updateDoc(doc(getColl('pins'), pinDoc.id), { 
                usageCount: increment(1),
                studentId: student.id 
            });

            // Fetch subject names
            const subSnap = await getDocs(getColl('subjects'));
            const subjectMap = {};
            subSnap.forEach(d => subjectMap[d.id] = d.data().name);

            // Compile Result
            setResultData({
                student,
                results: results.map(r => ({ ...r, subjectName: subjectMap[r.subjectId] || 'Unknown' })),
                usageRemaining: pinData.maxUses - (pinData.usageCount + 1)
            });
            setStep(2);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const generateAIInsight = async () => {
      setLoadingInsight(true);
      try {
        const performanceSummary = resultData.results.map(r => `${r.subjectName}: ${r.score}/${r.totalQuestions}`).join(', ');
        const prompt = `Analyze these student exam results for ${resultData.student.fullName}: [${performanceSummary}]. 
        Write a short, encouraging, and specific academic advice paragraph (max 3 sentences) speaking directly to the student.
        Focus on their strengths and areas for improvement in a kind, educational tone.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();
        setAiInsight(data.candidates?.[0]?.content?.parts?.[0]?.text || "Could not generate insight at this time.");
      } catch (e) {
        console.error(e);
        setAiInsight("AI service is currently unavailable.");
      } finally {
        setLoadingInsight(false);
      }
    };

    const printResult = () => window.print();

    if (step === 1) {
        return (
            <Container className="py-12 flex justify-center">
                <Card className="w-full max-w-md text-center">
                    <div className="mb-6">
                        <img src={LOGO_URL} className="h-16 w-auto mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900">Result Checker</h2>
                        <p className="text-gray-500">{settings.resultInstructions}</p>
                    </div>
                    <div className="space-y-4">
                        <input className="w-full border p-3 rounded uppercase text-center tracking-widest" placeholder="EXAM NUMBER" value={examNum} onChange={e => setExamNum(e.target.value.toUpperCase())} />
                        <input className="w-full border p-3 rounded text-center tracking-widest" type="password" placeholder="SCRATCH CARD PIN" value={pinCode} onChange={e => setPinCode(e.target.value)} />
                        {error && <p className="text-red-500 text-sm font-bold bg-red-50 p-2 rounded">{error}</p>}
                        <Button onClick={checkResult} disabled={loading} className="w-full py-3">{loading ? 'Verifying...' : 'Check Result'}</Button>
                    </div>
                </Card>
            </Container>
        );
    }

    // Result Sheet View
    const totalScore = resultData.results.reduce((a, b) => a + b.score, 0);
    const totalObtainable = resultData.results.reduce((a, b) => a + b.totalQuestions, 0);
    const average = (totalScore / resultData.results.length).toFixed(1);

    return (
        <div className="bg-white min-h-screen p-8 print:p-0">
            <div className="max-w-4xl mx-auto border-4 border-double border-blue-900 p-8 bg-white relative print:border-0">
                {/* Result Header */}
                <div className="text-center border-b-2 border-blue-900 pb-6 mb-6">
                    <img src={LOGO_URL} className="h-24 mx-auto mb-2" />
                    <h1 className="text-3xl font-bold text-blue-900 uppercase tracking-wide">{settings.schoolName}</h1>
                    <p className="text-gray-600">Student Academic Report Sheet</p>
                </div>

                {/* Student Info */}
                <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
                    <div className="p-4 bg-blue-50 rounded border border-blue-100">
                        <p className="text-gray-500">Student Name</p>
                        <p className="text-lg font-bold text-blue-900">{resultData.student.fullName}</p>
                    </div>
                     <div className="p-4 bg-blue-50 rounded border border-blue-100">
                        <p className="text-gray-500">Exam Number</p>
                        <p className="text-lg font-bold text-blue-900">{resultData.student.examNumber}</p>
                    </div>
                </div>

                {/* Scores Table */}
                <table className="w-full mb-8 border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-blue-900 text-white">
                            <th className="p-3 text-left border border-gray-300">Subject</th>
                            <th className="p-3 text-center border border-gray-300">Questions</th>
                            <th className="p-3 text-center border border-gray-300">Score</th>
                            <th className="p-3 text-center border border-gray-300">Grade</th>
                        </tr>
                    </thead>
                    <tbody>
                        {resultData.results.map((r, i) => {
                            const percent = (r.score / r.totalQuestions) * 100;
                            let grade = 'F';
                            if (percent >= 70) grade = 'A';
                            else if (percent >= 60) grade = 'B';
                            else if (percent >= 50) grade = 'C';
                            else if (percent >= 40) grade = 'D';
                            
                            return (
                                <tr key={i} className="even:bg-gray-50">
                                    <td className="p-3 border border-gray-300 font-medium">{r.subjectName}</td>
                                    <td className="p-3 border border-gray-300 text-center">{r.totalQuestions}</td>
                                    <td className="p-3 border border-gray-300 text-center font-bold">{r.score}</td>
                                    <td className={`p-3 border border-gray-300 text-center font-bold ${grade === 'F' ? 'text-red-600' : 'text-blue-600'}`}>{grade}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-4 mb-8 text-center">
                    <div className="border-2 border-gray-200 p-4 rounded">
                        <div className="text-xs text-gray-500 uppercase">Total Score</div>
                        <div className="text-2xl font-bold">{totalScore} / {totalObtainable}</div>
                    </div>
                     <div className="border-2 border-gray-200 p-4 rounded">
                        <div className="text-xs text-gray-500 uppercase">Average</div>
                        <div className="text-2xl font-bold">{average}</div>
                    </div>
                     <div className="border-2 border-gray-200 p-4 rounded">
                        <div className="text-xs text-gray-500 uppercase">Verdict</div>
                        <div className={`text-2xl font-bold ${parseInt(average) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                            {parseInt(average) >= 50 ? 'PASSED' : 'FAILED'}
                        </div>
                    </div>
                </div>

                {/* AI Insight Section */}
                <div className="mb-8 print:hidden">
                   {!aiInsight ? (
                     <Button variant="magic" onClick={generateAIInsight} disabled={loadingInsight} className="w-full">
                       {loadingInsight ? <span className="flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Analyzing Performance...</span> : "✨ Get AI Academic Advice"}
                     </Button>
                   ) : (
                     <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100 relative">
                        <div className="flex items-center mb-2 text-indigo-700 font-bold">
                           <Sparkles className="w-5 h-5 mr-2" /> AI Academic Insight
                        </div>
                        <p className="text-gray-800 italic leading-relaxed">"{aiInsight}"</p>
                     </div>
                   )}
                </div>

                {/* Remarks */}
                <div className="border-t-2 border-gray-100 pt-6 flex justify-between items-end">
                    <div>
                        <p className="text-sm font-bold text-gray-400 uppercase mb-2">Administrator's Remark</p>
                        <p className="italic text-gray-700 mb-4">"{settings.adminMessage}"</p>
                        <div className="h-px w-48 bg-gray-300 mb-1"></div>
                        <p className="text-xs font-bold">{settings.adminName}</p>
                    </div>
                    <div className="text-right text-xs text-gray-400">
                        <p>Generated: {new Date().toLocaleString()}</p>
                        <p>PIN Uses Remaining: {resultData.usageRemaining}</p>
                    </div>
                </div>

                 {/* Print Button (Hidden in Print) */}
                 <div className="absolute top-4 right-4 print:hidden">
                     <Button onClick={printResult}><Download className="w-4 h-4 mr-2 inline"/> Print Result</Button>
                     <Button variant="secondary" className="ml-2" onClick={() => setStep(1)}>Back</Button>
                 </div>
            </div>
        </div>
    );
}