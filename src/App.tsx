import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sun,
  Moon,
  Monitor,
  ChevronLeft,
  ChevronRight,
  Trash2,
  LayoutDashboard, 
  MessageSquare, 
  Settings, 
  PlusCircle, 
  MessageSquarePlus,
  Send, 
  MoreVertical, 
  Bell, 
  ArrowLeft,
  Sparkles,
  Fingerprint,
  History,
  Cpu,
  Image as ImageIcon,
  Link as LinkIcon,
  CheckCircle2,
  Smile,
  Menu,
  X,
  Languages,
  WifiOff,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Globe,
  Key,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { Character, Message, AIConfig, AIProvider } from './types';
import { streamChat, parseResponse, translateText, getTodayDateString } from './services/aiService';
import { cn } from './lib/utils';

function getBestEnglishVoice(voices: SpeechSynthesisVoice[]) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let preferredNames: string[] = [];

  if (/iPhone|iPad|iPod/.test(ua)) {
    preferredNames = ['Samantha', 'Nicky', 'Aaron'];
  } else if (/Android/.test(ua)) {
    preferredNames = ['Google US English', 'en-US-Language', 'en-us-x-sfg-local'];
  } else if (/Macintosh/.test(ua)) {
    preferredNames = ['Samantha', 'Alex', 'Victoria', 'Daniel'];
  } else if (/Windows/.test(ua)) {
    preferredNames = ['Microsoft Zira', 'Microsoft David', 'Microsoft Hazel'];
  } else {
    preferredNames = ['Google US English', 'Google UK English Female'];
  }

  // Exact matches first
  let best = voices.find(v => preferredNames.includes(v.name));
  
  // Partial matches if no exact match
  if (!best) {
    best = voices.find(v => preferredNames.some(name => v.name.includes(name)));
  }

  // Language match if still no match
  if (!best) {
    best = voices.find(v => v.lang.startsWith('en-US')) || voices.find(v => v.lang.startsWith('en'));
  }
  
  return best;
}

const INITIAL_CHARACTERS: Character[] = [
  {
    id: '1',
    name: 'Ms. Sunny',
    personality: 'Vui vẻ, năng động, cực kỳ kiên nhẫn và yêu trẻ em.',
    description: 'Cô giáo tiếng Anh thân thiện dành cho các bé mầm non và tiểu học.',
    context: 'Một lớp học rực rỡ sắc màu với gấu bông và bảng chữ cái vui nhộn.',
    story: 'Sunny tin rằng học tiếng Anh là một cuộc phiêu lưu. Cô sử dụng bài hát, câu chuyện và những lời khen ngợi để giúp trẻ tự tin giao tiếp.',
    avatarUrl: 'https://picsum.photos/seed/sunny/400/400',
    version: 'KIDS v1.0',
    status: 'Operational',
    enableSpellingCorrection: true,
    enableSuggestions: true,
  },
  {
    id: '2',
    name: 'Teacher Alex',
    personality: 'Tận tâm, giải thích cặn kẽ, phương pháp học tập khoa học.',
    description: 'Gia sư tiếng Anh đồng hành cùng học sinh phổ thông trong học tập.',
    context: 'Một phòng học trực tuyến hiện đại với bảng trắng và tài liệu học tập.',
    story: 'Alex giúp học sinh vượt qua nỗi sợ ngữ pháp và xây dựng nền tảng từ vựng vững chắc để đạt điểm cao trong các kỳ thi ở trường.',
    avatarUrl: 'https://picsum.photos/seed/alex/400/400',
    version: 'STUDENT v2.1',
    status: 'Operational',
    enableSpellingCorrection: true,
    enableSuggestions: true,
  },
  {
    id: '3',
    name: 'IELTS Master',
    personality: 'Chuyên nghiệp, sắc sảo, tập trung vào chiến thuật và tư duy phản biện.',
    description: 'Chuyên gia luyện thi IELTS giúp bạn chinh phục band điểm mục tiêu.',
    context: 'Một trung tâm khảo thí quốc tế yên tĩnh và chuyên nghiệp.',
    story: 'Với kinh nghiệm chấm thi, Master sẽ hướng dẫn bạn cách tối ưu hóa điểm số trong cả 4 kỹ năng, đặc biệt là Writing và Speaking.',
    avatarUrl: 'https://picsum.photos/seed/ielts/400/400',
    version: 'IELTS v5.0',
    status: 'Operational',
    enableSpellingCorrection: true,
    enableSuggestions: true,
  },
  {
    id: '4',
    name: 'TOEIC Coach',
    personality: 'Thực tế, quyết đoán, tập trung vào hiệu quả và kỹ năng làm đề.',
    description: 'Huấn luyện viên luyện thi TOEIC dành cho sinh viên và người đi làm.',
    context: 'Môi trường học tập cường độ cao với các bộ đề thi sát thực tế.',
    story: 'Coach tập trung vào việc giúp bạn nắm vững cấu trúc đề thi, bẫy thường gặp và kỹ thuật quản lý thời gian để đạt điểm tối đa.',
    avatarUrl: 'https://picsum.photos/seed/toeic/400/400',
    version: 'TOEIC v3.2',
    status: 'Operational',
    enableSpellingCorrection: true,
    enableSuggestions: true,
  },
  {
    id: '5',
    name: 'Mr. James',
    personality: 'Lịch thiệp, chuyên nghiệp, am hiểu văn hóa doanh nghiệp quốc tế.',
    description: 'Chuyên gia tiếng Anh giao tiếp dành cho người đi làm và doanh nhân.',
    context: 'Một phòng họp sang trọng hoặc không gian làm việc chuyên nghiệp.',
    story: 'James giúp bạn làm chủ tiếng Anh trong các tình huống thực tế như viết email, thuyết trình, đàm phán và giao tiếp xã hội trong công việc.',
    avatarUrl: 'https://picsum.photos/seed/james/400/400',
    version: 'BUSINESS v4.0',
    status: 'Operational',
    enableSpellingCorrection: true,
    enableSuggestions: true,
  }
];

// Safe localStorage helper to prevent crashing in third-party sandboxed iframe environments
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`LocalStorage blocked or unavailable for key "${key}":`, e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`LocalStorage failed to write for key "${key}":`, e);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`LocalStorage failed to remove for key "${key}":`, e);
    }
  },
  clear: (): void => {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn("LocalStorage failed to clear:", e);
    }
  }
};

const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'google',
  modelId: 'gemini-3-flash-preview',
  apiKey: process.env.GEMINI_API_KEY || '',
  googleApiKey: process.env.GEMINI_API_KEY || '',
  googleModelId: 'gemini-3-flash-preview',
  translationLanguage: 'vi',
  translationProvider: 'free',
  geminiKeysPool: [],
  useRotation: false
};

export default function App() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<'dashboard' | 'creator' | 'chat' | 'settings'>('dashboard');
  const [characters, setCharacters] = useState<Character[]>(() => {
    try {
      const saved = safeLocalStorage.getItem('muse_characters');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse characters from localStorage", e);
    }
    // If no characters found or error, return the initial ones
    return INITIAL_CHARACTERS;
  });
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    try {
      const saved = safeLocalStorage.getItem('muse_ai_config');
      if (saved) {
        const parsed = JSON.parse(saved) as AIConfig;
        if (parsed.nvidiaBaseUrl === 'https://integrate.api.nvidia.com') {
          parsed.nvidiaBaseUrl = 'https://integrate.api.nvidia.com/v1';
        }
        
        // Migrate previously saved keys and models to provider-specific fields
        if (parsed.provider === 'google' && !parsed.googleApiKey && parsed.apiKey) {
          parsed.googleApiKey = parsed.apiKey;
        }
        if (parsed.provider === 'nvidia' && !parsed.nvidiaApiKey && parsed.apiKey) {
          parsed.nvidiaApiKey = parsed.apiKey;
        }
        if (parsed.provider === 'openai' && !parsed.openaiApiKey && parsed.apiKey) {
          parsed.openaiApiKey = parsed.apiKey;
        }
        
        if (parsed.provider === 'google' && !parsed.googleModelId && parsed.modelId) {
          parsed.googleModelId = parsed.modelId;
        }
        if (parsed.provider === 'nvidia' && !parsed.nvidiaModelId && parsed.modelId) {
          parsed.nvidiaModelId = parsed.modelId;
        }
        if (parsed.provider === 'openai' && !parsed.openaiModelId && parsed.modelId) {
          parsed.openaiModelId = parsed.modelId;
        }
        
        return parsed;
      }
      return DEFAULT_AI_CONFIG;
    } catch (e) {
      console.error("Failed to parse AI config from localStorage", e);
      return DEFAULT_AI_CONFIG;
    }
  });
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);
  const [chatHistory, setChatHistory] = useState<Record<string, Message[]>>(() => {
    try {
      const saved = safeLocalStorage.getItem('muse_chat_history');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error("Failed to parse chat history from localStorage", e);
      return {};
    }
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string>(() => {
    return safeLocalStorage.getItem('muse_user_avatar') || 'https://picsum.photos/seed/user/100/100';
  });
  const [isSelectingCharacter, setIsSelectingCharacter] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverConfig, setServerConfig] = useState<{
    nvidiaConfigured: boolean;
    geminiConfigured: boolean;
    openaiConfigured: boolean;
    nvidiaModel: string;
    nvidiaBaseUrl: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setServerConfig(data);
        setAiConfig(prev => {
          const updated = { ...prev };
          if (data.nvidiaConfigured && prev.provider === 'nvidia' && !prev.apiKey) {
            updated.nvidiaBaseUrl = data.nvidiaBaseUrl;
            updated.modelId = data.nvidiaModel;
          }
          return updated;
        });
      })
      .catch(err => console.error("Failed to fetch server config:", err));
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Theme Logic
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.remove('light', 'dark');
      root.classList.add(systemTheme);
    } else {
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
    }
  }, [theme]);

  // Persistence
  useEffect(() => {
    try {
      safeLocalStorage.setItem('muse_characters', JSON.stringify(characters));
      setStorageError(null);
    } catch (e) {
      console.error('Failed to save characters to localStorage:', e);
      setStorageError('Storage quota exceeded. Try using image URLs instead of uploading large files, or clear some chat history.');
    }
  }, [characters]);

  useEffect(() => {
    try {
      safeLocalStorage.setItem('muse_chat_history', JSON.stringify(chatHistory));
      setStorageError(null);
    } catch (e) {
      console.error('Failed to save chat history to localStorage:', e);
      setStorageError('Storage quota exceeded. Try clearing some chat history to free up space.');
    }
  }, [chatHistory]);

  useEffect(() => {
    try {
      safeLocalStorage.setItem('muse_ai_config', JSON.stringify(aiConfig));
    } catch (e) {
      console.error('Failed to save AI config to localStorage:', e);
    }
  }, [aiConfig]);

  useEffect(() => {
    try {
      safeLocalStorage.setItem('muse_user_avatar', userAvatar);
    } catch (e) {
      console.error('Failed to save user avatar to localStorage. It might be too large.', e);
    }
  }, [userAvatar]);

  const [newChar, setNewChar] = useState<Partial<Character>>({
    name: '',
    personality: '',
    description: '',
    context: '',
    story: '',
    avatarUrl: '',
    status: 'Operational',
    version: 'v1.0',
    voiceId: '',
    enableSpellingCorrection: true,
    enableSuggestions: true
  });

  const handleCreateCharacter = () => {
    if (!newChar.name) return;
    
    if (editingCharacterId) {
      // Update existing character
      setCharacters(characters.map(c => 
        c.id === editingCharacterId ? { ...c, ...newChar } as Character : c
      ));
      // Update active character if it's the one being edited
      if (activeCharacter?.id === editingCharacterId) {
        setActiveCharacter({ ...activeCharacter, ...newChar } as Character);
      }
    } else {
      // Create new character
      const char: Character = {
        ...newChar as Character,
        id: `char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now()
      };
      setCharacters([...characters, char]);
    }

    setView('dashboard');
    setEditingCharacterId(null);
    setNewChar({
      name: '',
      personality: '',
      description: '',
      context: '',
      story: '',
      avatarUrl: '',
      status: 'Operational',
      version: 'v1.0',
      voiceId: '',
      enableSpellingCorrection: true,
      enableSuggestions: true
    });
  };

  const handleEditCharacter = (char: Character) => {
    setEditingCharacterId(char.id);
    setNewChar({
      name: char.name,
      personality: char.personality,
      description: char.description,
      context: char.context,
      story: char.story,
      avatarUrl: char.avatarUrl,
      status: char.status,
      version: char.version,
      voiceId: char.voiceId,
      enableSpellingCorrection: char.enableSpellingCorrection || false,
      enableSuggestions: char.enableSuggestions || false
    });
    setView('creator');
  };

  const handleDeleteCharacter = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: t('common.delete'),
      message: t('common.confirm_delete'),
      onConfirm: () => {
        setCharacters(characters.filter(c => c.id !== id));
        // Clear history for deleted character
        const { [id]: _, ...newHistory } = chatHistory;
        setChatHistory(newHistory);
        
        if (activeCharacter?.id === id) {
          setActiveCharacter(null);
          setView('dashboard');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert('Image is too large (max 500KB). Please use an image URL instead for better performance and to save storage space.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewChar({ ...newChar, avatarUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const startChat = (char: Character) => {
    setActiveCharacter(char);
    setView('chat');
    setIsSidebarOpen(false);
  };

  return (
    <div className="fixed inset-0 flex bg-background text-on-surface overflow-hidden overscroll-none">
      {/* Offline Indicator */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-destructive text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold"
          >
            <WifiOff size={14} />
            {t('common.offline_mode') || 'Offline Mode - AI requires internet'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-surface-container-low border-r border-outline-variant/20 transition-all duration-300 transform lg:relative lg:translate-x-0 flex flex-col",
        !isSidebarOpen && "-translate-x-full",
        isSidebarCollapsed ? "w-20" : "w-72"
      )}>
        {storageError && (
          <div className="bg-tertiary/10 p-3 m-2 rounded-lg border border-tertiary/20 text-[10px] text-tertiary font-bold animate-pulse">
            ⚠️ {storageError}
          </div>
        )}
        <div className={cn("p-6 flex items-center", isSidebarCollapsed ? "justify-center" : "justify-between")}>
          {!isSidebarCollapsed && (
            <div>
              <h1 className="text-xl font-black tracking-tighter text-primary uppercase font-headline text-nowrap">Virtual Character AI</h1>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:block p-2 hover:bg-white/5 rounded-lg transition-colors text-on-surface-variant"
            >
              {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-white/5 rounded-lg transition-colors text-primary"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-4 mb-4">
          <button 
            onClick={() => setIsSelectingCharacter(true)}
            className={cn(
              "w-full bg-primary text-background font-bold rounded-xl flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 border border-primary/30",
              isSidebarCollapsed ? "h-12 w-12 mx-auto p-0" : "py-3 px-4"
            )}
            title={t('common.new_chat')}
          >
            <MessageSquarePlus size={20} />
            {!isSidebarCollapsed && <span>{t('common.new_chat')}</span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label={t('common.dashboard')} 
            active={view === 'dashboard'} 
            onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }} 
            collapsed={isSidebarCollapsed}
          />
          
          {!isSidebarCollapsed && (
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-3 mt-6 mb-2 opacity-50">{t('common.conversations')}</p>
          )}
          
          {characters
            .filter(char => chatHistory[char.id] && chatHistory[char.id].length > 0)
            .map((char, index) => (
              <NavItem 
                key={`${char.id}-${index}`}
                icon={<div className="w-5 h-5 rounded-full overflow-hidden"><img src={char.avatarUrl || null} className="w-full h-full object-cover" /></div>}
                label={char.name}
                active={view === 'chat' && activeCharacter?.id === char.id}
                onClick={() => startChat(char)}
                collapsed={isSidebarCollapsed}
              />
            ))}
        </div>

        <div className="p-4 border-t border-outline-variant/10 space-y-1">
          <NavItem 
            icon={<Settings size={20} />} 
            label={t('common.settings')} 
            active={view === 'settings'} 
            onClick={() => { setView('settings'); setIsSidebarOpen(false); }} 
            collapsed={isSidebarCollapsed}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {/* Header */}
        <header className="h-16 flex-shrink-0 border-b border-outline-variant/10 bg-background/80 backdrop-blur-xl flex items-center justify-between px-6 z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 hover:bg-white/5 rounded-lg transition-colors text-primary"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            {view !== 'dashboard' && (
              <button onClick={() => setView('dashboard')} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="text-base sm:text-lg font-bold bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent font-headline truncate">
              {view === 'dashboard' ? 'Virtual Character AI' : view === 'creator' ? (editingCharacterId ? t('common.edit') : t('common.new_character')) : view === 'settings' ? t('common.settings') : activeCharacter?.name}
            </h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {view === 'chat' && activeCharacter && (
              <button 
                onClick={() => {
                  setConfirmModal({
                    isOpen: true,
                    title: t('common.clear_chat'),
                    message: t('common.confirm_clear'),
                    onConfirm: () => {
                      setChatHistory(prev => ({ ...prev, [activeCharacter.id]: [] }));
                      setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    }
                  });
                }}
                className="p-2 text-on-surface-variant hover:text-destructive transition-colors flex items-center gap-2 text-xs font-bold"
                title={t('common.clear_chat')}
              >
                <Trash2 size={18} />
                <span className="hidden sm:inline">{t('common.clear_chat')}</span>
              </button>
            )}
          </div>
        </header>

        {/* View Content */}
        <div className={cn("flex-1 min-h-0", view !== 'chat' ? "overflow-y-auto custom-scrollbar p-8" : "flex flex-col")}>
          <AnimatePresence mode="wait">
            {confirmModal.isOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="bg-surface-container-low border border-outline-variant/30 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="p-6 border-b border-outline-variant/10">
                    <h3 className="text-xl font-bold font-headline text-on-surface">{confirmModal.title}</h3>
                  </div>
                  <div className="p-6">
                    <p className="text-on-surface-variant text-sm leading-relaxed">{confirmModal.message}</p>
                  </div>
                  <div className="p-6 bg-surface-container-highest/50 flex items-center justify-end gap-3">
                    <button 
                      onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                      className="px-6 py-2.5 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-white/5 transition-all"
                    >
                      {t('common.cancel')}
                    </button>
                    <button 
                      onClick={confirmModal.onConfirm}
                      className="px-6 py-2.5 rounded-xl font-bold text-sm bg-tertiary text-background hover:shadow-lg hover:shadow-tertiary/20 transition-all active:scale-95"
                    >
                      {t('common.confirm_action', { defaultValue: 'Confirm' })}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
            {isSelectingCharacter && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
                onClick={() => setIsSelectingCharacter(false)}
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="bg-surface-container-low border border-outline-variant/30 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
                    <h3 className="text-xl font-bold font-headline">{t('common.new_chat')}</h3>
                    <button onClick={() => setIsSelectingCharacter(false)} className="p-2 hover:bg-white/5 rounded-full">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <p className="text-on-surface-variant text-sm mb-6">Select a character to start a new conversation.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {characters.map((char, index) => (
                        <button 
                          key={`${char.id}-${index}`}
                          onClick={() => {
                            startChat(char);
                            setIsSelectingCharacter(false);
                          }}
                          className="flex items-center gap-4 p-4 bg-surface-container-highest hover:bg-primary hover:text-background rounded-2xl transition-all group text-left"
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-outline-variant/20 group-hover:border-background/20">
                            <img src={char.avatarUrl || null} alt={char.name} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{char.name}</p>
                            <p className="text-[10px] opacity-60 line-clamp-1">{char.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
            {storageError && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 p-4 bg-tertiary/10 border border-tertiary/20 rounded-xl text-tertiary text-xs font-bold flex items-center justify-between"
              >
                <span>{storageError}</span>
                <button onClick={() => setStorageError(null)} className="p-1 hover:bg-tertiary/10 rounded-full">
                  <X size={14} />
                </button>
              </motion.div>
            )}
            {view === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-7xl mx-auto"
              >
                <section className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <h3 className="text-on-surface-variant font-headline text-[10px] sm:text-sm tracking-widest uppercase mb-2">{t('common.welcome')}</h3>
                    <h1 className="font-headline text-3xl sm:text-4xl md:text-5xl font-extrabold text-on-surface tracking-tighter mb-4">{t('common.dashboard')}</h1>
                    <p className="text-on-surface-variant max-w-2xl text-base sm:text-lg">{t('common.dashboard_desc')}</p>
                  </div>
                  <button 
                    onClick={() => setView('creator')}
                    className="flex items-center gap-2 bg-primary text-background px-6 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95 self-start md:self-auto"
                  >
                    <PlusCircle size={20} />
                    <span>{t('common.new_character')}</span>
                  </button>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <div 
                    onClick={() => setView('creator')}
                    className="group relative h-96 bg-surface-container-low rounded-xl border border-dashed border-outline-variant hover:border-primary/50 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col items-center justify-center text-center p-8"
                  >
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="w-20 h-20 rounded-full bg-surface-container-highest flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary transition-all duration-500">
                      <PlusCircle size={40} className="text-primary group-hover:text-background" />
                    </div>
                    <h4 className="font-headline text-xl sm:text-2xl font-bold mb-2 text-on-surface">{t('common.forge_identity')}</h4>
                    <p className="text-on-surface-variant text-sm">{t('common.forge_desc')}</p>
                  </div>

                  {characters.length === 0 && (
                    <div 
                      onClick={() => setCharacters(INITIAL_CHARACTERS)}
                      className="group relative h-96 bg-surface-container-low rounded-xl border border-dashed border-outline-variant hover:border-secondary/50 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col items-center justify-center text-center p-8"
                    >
                      <div className="absolute inset-0 bg-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      <div className="w-20 h-20 rounded-full bg-surface-container-highest flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-secondary transition-all duration-500">
                        <History size={40} className="text-secondary group-hover:text-background" />
                      </div>
                      <h4 className="font-headline text-xl sm:text-2xl font-bold mb-2 text-on-surface">{t('common.restore_defaults')}</h4>
                      <p className="text-on-surface-variant text-sm">{t('common.restore_defaults_desc')}</p>
                    </div>
                  )}

                  {characters.map((char, index) => (
                    <CharacterCard 
                      key={`${char.id}-${index}`} 
                      character={char} 
                      onChat={() => startChat(char)} 
                      onEdit={() => handleEditCharacter(char)}
                      onDelete={() => handleDeleteCharacter(char.id)}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {view === 'creator' && (
              <motion.div 
                key="creator"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12"
              >
                <div className="lg:col-span-8 space-y-10">
                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Fingerprint size={18} />
                      </div>
                      <h3 className="text-lg sm:text-xl font-headline font-bold text-on-surface">{t('common.forge_identity')}</h3>
                    </div>
                    <div className="space-y-4">
                      <InputGroup label={t('common.character_name')} placeholder="e.g. Orion Vax, Cyber-Navigator" value={newChar.name} onChange={v => setNewChar({...newChar, name: v})} />
                      <InputGroup label={t('common.personality')} placeholder="Analytical, witty, slightly cynical..." value={newChar.personality} onChange={v => setNewChar({...newChar, personality: v})} />
                      <InputGroup label={t('common.setting_context')} placeholder="e.g. A neon-lit rooftop in Neo-Tokyo..." value={newChar.context} onChange={v => setNewChar({...newChar, context: v})} />
                      <TextAreaGroup label={t('common.biography')} placeholder="A brief overview of who this character is to the world..." value={newChar.description} onChange={v => setNewChar({...newChar, description: v})} rows={3} />
                      
                      <div className="pt-4">
                        <VoiceSelector 
                          value={newChar.voiceId || ''} 
                          onChange={v => setNewChar({...newChar, voiceId: v})} 
                        />
                      </div>

                      <div className="pt-4 space-y-3">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Tính năng hỗ trợ (AI Features)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <button 
                            type="button"
                            onClick={() => setNewChar({...newChar, enableSpellingCorrection: !newChar.enableSpellingCorrection})}
                            className={cn(
                              "flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
                              newChar.enableSpellingCorrection 
                                ? "bg-primary/10 border-primary text-primary" 
                                : "bg-surface-container border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"
                            )}
                          >
                            <div className={cn(
                              "w-5 h-5 rounded flex items-center justify-center border transition-all",
                              newChar.enableSpellingCorrection 
                                ? "border-primary bg-primary text-background animate-scale-up" 
                                : "border-outline-variant"
                            )}>
                              {newChar.enableSpellingCorrection && <Check size={14} className="stroke-[3]" />}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-on-surface">{t('common.enable_correction')}</p>
                              <p className="text-[10px] opacity-70">Sửa lỗi chính tả & ngữ pháp sau mỗi tin nhắn</p>
                            </div>
                          </button>

                          <button 
                            type="button"
                            onClick={() => setNewChar({...newChar, enableSuggestions: !newChar.enableSuggestions})}
                            className={cn(
                              "flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
                              newChar.enableSuggestions 
                                ? "bg-secondary/10 border-secondary text-secondary" 
                                : "bg-surface-container border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"
                            )}
                          >
                            <div className={cn(
                              "w-5 h-5 rounded flex items-center justify-center border transition-all",
                              newChar.enableSuggestions 
                                ? "border-secondary bg-secondary text-background animate-scale-up" 
                                : "border-outline-variant"
                            )}>
                              {newChar.enableSuggestions && <Check size={14} className="stroke-[3]" />}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-on-surface">{t('common.enable_suggestions')}</p>
                              <p className="text-[10px] opacity-70">Gợi ý các câu trả lời tiếp theo để tiếp tục hội thoại</p>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                        <Sparkles size={18} />
                      </div>
                      <h3 className="text-lg sm:text-xl font-headline font-bold text-on-surface">Deep Narrative</h3>
                    </div>
                    <TextAreaGroup label="The Origin Story" placeholder="Describe the pivotal moments and hidden motivations..." value={newChar.story} onChange={v => setNewChar({...newChar, story: v})} rows={6} />
                  </section>

                  <div className="pt-8 flex items-center gap-4">
                    <button 
                      onClick={handleCreateCharacter}
                      className="px-8 py-4 bg-gradient-to-br from-primary to-primary-dim text-background font-bold rounded-full shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95"
                    >
                      {editingCharacterId ? t('common.save') : t('common.forge_identity')}
                    </button>
                    <button onClick={() => {
                      setView('dashboard');
                      setEditingCharacterId(null);
                    }} className="px-8 py-4 bg-transparent text-on-surface-variant font-semibold rounded-full border border-outline-variant/30 hover:bg-white/5 transition-all">
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-8">
                  <div className="bg-surface-container-low rounded-3xl p-6 border-t-2 border-surface-bright shadow-2xl relative overflow-hidden">
                    <h4 className="text-sm font-bold text-on-surface uppercase tracking-widest mb-6">{t('common.visual_anchor')}</h4>
                    <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-surface-container-highest group border-2 border-dashed border-outline-variant/30 flex items-center justify-center mb-6">
                      {newChar.avatarUrl ? (
                        <>
                          <img src={newChar.avatarUrl || null} alt="Avatar" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <label className="cursor-pointer bg-white/20 backdrop-blur-md p-3 rounded-full hover:bg-white/30 transition-all">
                              <ImageIcon size={24} className="text-white" />
                              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </label>
                          </div>
                        </>
                      ) : (
                        <label className="relative z-10 flex flex-col items-center gap-3 cursor-pointer">
                          <div className="w-16 h-16 rounded-full bg-primary/20 backdrop-blur-md flex items-center justify-center text-primary border border-primary/30 group-hover:scale-110 transition-transform">
                            <PlusCircle size={30} />
                          </div>
                          <p className="text-xs font-medium text-on-surface-variant">{t('common.click_upload')}</p>
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                        <input 
                          className="w-full bg-surface-container-highest/50 border-none rounded-lg pl-10 pr-4 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary/50 transition-all" 
                          placeholder={t('common.paste_url')} 
                          value={newChar.avatarUrl}
                          onChange={e => setNewChar({...newChar, avatarUrl: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'settings' && (
              <SettingsView 
                theme={theme}
                setTheme={setTheme}
                aiConfig={aiConfig}
                onSaveAiConfig={setAiConfig}
                userAvatar={userAvatar}
                onUpdateAvatar={setUserAvatar}
                chatHistory={chatHistory}
                setChatHistory={setChatHistory}
                setConfirmModal={setConfirmModal}
                serverConfig={serverConfig}
              />
            )}

            {view === 'chat' && activeCharacter && (
              <ChatView 
                key={`chat-${activeCharacter.id}`}
                character={activeCharacter} 
                onUpdateCharacter={(updatedChar) => {
                  setCharacters(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c));
                  setActiveCharacter(updatedChar);
                }}
                history={chatHistory[activeCharacter.id] || []} 
                onUpdateHistory={(newHistory) => setChatHistory(prev => ({ ...prev, [activeCharacter.id]: newHistory }))}
                isSidebarCollapsed={isSidebarCollapsed}
                aiConfig={aiConfig}
                onUpdateAiConfig={setAiConfig}
                userAvatar={userAvatar}
                setConfirmModal={setConfirmModal}
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, collapsed?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group",
        active 
          ? "text-primary font-bold bg-primary/10 ring-1 ring-primary/20" 
          : "text-on-surface-variant font-medium hover:text-on-surface hover:bg-white/5",
        collapsed && "justify-center px-0"
      )}
      title={collapsed ? label : undefined}
    >
      <div className={cn("transition-transform duration-300", active && "scale-110")}>
        {icon}
      </div>
      {!collapsed && <span className="font-sans text-sm truncate">{label}</span>}
      {!collapsed && active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(182,160,255,0.8)]"></div>}
    </button>
  );
}

function SettingsView({ 
  theme, 
  setTheme, 
  aiConfig, 
  onSaveAiConfig, 
  userAvatar, 
  onUpdateAvatar, 
  chatHistory, 
  setChatHistory,
  setConfirmModal,
  serverConfig
}: { 
  theme: 'dark' | 'light' | 'system', 
  setTheme: (t: 'dark' | 'light' | 'system') => void, 
  aiConfig: AIConfig, 
  onSaveAiConfig: (c: AIConfig) => void, 
  userAvatar: string, 
  onUpdateAvatar: (url: string) => void, 
  chatHistory: Record<string, Message[]>, 
  setChatHistory: (h: Record<string, Message[]>) => void,
  setConfirmModal: (modal: any) => void,
  serverConfig: {
    nvidiaConfigured: boolean;
    geminiConfigured: boolean;
    openaiConfigured: boolean;
    nvidiaModel: string;
    nvidiaBaseUrl: string;
  } | null
}) {
  const { t, i18n } = useTranslation();
  const [tempConfig, setTempConfig] = useState<AIConfig>(aiConfig);
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newPoolKey, setNewPoolKey] = useState('');
  const [newPoolKeyLimit, setNewPoolKeyLimit] = useState(20);

  const handleAddKeyToPool = () => {
    if (!newPoolKey.trim()) return;
    const newEntry = {
      id: `key-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      key: newPoolKey.trim(),
      usageCount: 0,
      lastUsedDate: getTodayDateString(),
      status: 'active' as const,
      maxDailyRequests: newPoolKeyLimit
    };
    
    const updatedPool = [...(tempConfig.geminiKeysPool || []), newEntry];
    setTempConfig({
      ...tempConfig,
      geminiKeysPool: updatedPool
    });
    setNewPoolKey('');
  };

  const handleRemoveKeyFromPool = (id: string) => {
    const updatedPool = (tempConfig.geminiKeysPool || []).filter(item => item.id !== id);
    setTempConfig({
      ...tempConfig,
      geminiKeysPool: updatedPool
    });
  };

  const handleResetPoolUsage = () => {
    const updatedPool = (tempConfig.geminiKeysPool || []).map(item => ({
      ...item,
      usageCount: 0,
      status: 'active' as const,
      errorMsg: undefined
    }));
    setTempConfig({
      ...tempConfig,
      geminiKeysPool: updatedPool
    });
  };

  const handleSaveConfig = () => {
    onSaveAiConfig(tempConfig);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert('Image is too large (max 500KB). Please use an image URL instead.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <motion.div 
      key="settings"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-3xl mx-auto space-y-8 pb-12"
    >
      <header className="text-center mb-12">
        <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tighter mb-2">{t('common.settings')}</h1>
        <p className="text-on-surface-variant text-sm">Configure your experience and manage your data.</p>
      </header>

      {/* User Avatar Section */}
      <section className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/20 flex flex-col md:flex-row items-center gap-8">
        <div className="relative">
          <div 
            className="w-32 h-32 rounded-full border-4 border-primary p-1 cursor-pointer group relative overflow-hidden"
            onClick={handleAvatarClick}
          >
            <img src={userAvatar || null} className="w-full h-full object-cover rounded-full transition-transform group-hover:scale-110" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ImageIcon size={24} className="text-white" />
            </div>
          </div>
          <button 
            onClick={handleAvatarClick}
            className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-background rounded-full flex items-center justify-center border-4 border-background hover:scale-110 transition-transform"
          >
            <PlusCircle size={16} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange}
          />
        </div>
        <div className="flex-1 text-center md:text-left space-y-4">
          <div>
            <h3 className="text-xl font-bold text-on-surface">{t('common.avatar_settings')}</h3>
            <p className="text-xs text-on-surface-variant mt-1">{t('common.avatar_desc')}</p>
          </div>
          <div className="flex gap-2">
            <input 
              className="flex-1 bg-surface-container-highest border-none rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder={t('common.paste_url')}
              value={userAvatar.startsWith('data:') ? '' : userAvatar}
              onChange={e => onUpdateAvatar(e.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Theme Section */}
        <section className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Sun size={20} className="text-primary" />
            {t('common.interface_theme')}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <ThemeOption active={theme === 'light'} label={t('common.light')} icon={<Sun size={18} />} onClick={() => setTheme('light')} />
            <ThemeOption active={theme === 'dark'} label={t('common.dark')} icon={<Moon size={18} />} onClick={() => setTheme('dark')} />
            <ThemeOption active={theme === 'system'} label={t('common.system')} icon={<Monitor size={18} />} onClick={() => setTheme('system')} />
          </div>
        </section>

        {/* Language Section */}
        <section className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Languages size={20} className="text-primary" />
            {t('common.language')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => i18n.changeLanguage('en')}
              className={cn(
                "flex items-center justify-center gap-2 p-4 rounded-xl border transition-all font-bold text-sm",
                i18n.language === 'en' 
                  ? "bg-primary/10 border-primary text-primary" 
                  : "bg-surface-container-highest border-outline-variant/20 text-on-surface-variant hover:border-outline-variant"
              )}
            >
              English
            </button>
            <button 
              onClick={() => i18n.changeLanguage('vi')}
              className={cn(
                "flex items-center justify-center gap-2 p-4 rounded-xl border transition-all font-bold text-sm",
                i18n.language === 'vi' 
                  ? "bg-primary/10 border-primary text-primary" 
                  : "bg-surface-container-highest border-outline-variant/20 text-on-surface-variant hover:border-outline-variant"
              )}
            >
              Tiếng Việt
            </button>
          </div>
        </section>
      </div>

      {/* AI Config Section */}
      <section className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/20 space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Cpu size={24} className="text-primary" />
          {t('common.ai_config')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">{t('common.ai_provider')}</label>
            <select 
              className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer" 
              value={tempConfig.provider}
              onChange={e => {
                const prov = e.target.value as AIProvider;
                const oldProv = tempConfig.provider;

                // Save current provider key/model to its specific field before switching
                const updatedConfig = { ...tempConfig };
                if (oldProv === 'google') {
                  updatedConfig.googleApiKey = tempConfig.apiKey;
                  updatedConfig.googleModelId = tempConfig.modelId;
                } else if (oldProv === 'nvidia') {
                  updatedConfig.nvidiaApiKey = tempConfig.apiKey;
                  updatedConfig.nvidiaModelId = tempConfig.modelId;
                } else if (oldProv === 'openai') {
                  updatedConfig.openaiApiKey = tempConfig.apiKey;
                  updatedConfig.openaiModelId = tempConfig.modelId;
                }

                // Retrieve target provider key/model from its specific field or default
                let nextKey = '';
                let nextModel = '';
                let nextBaseUrl = tempConfig.nvidiaBaseUrl || '';

                if (prov === 'nvidia') {
                  nextKey = updatedConfig.nvidiaApiKey !== undefined ? updatedConfig.nvidiaApiKey : '';
                  nextModel = updatedConfig.nvidiaModelId || 'meta/llama-3.3-70b-instruct';
                  nextBaseUrl = tempConfig.nvidiaBaseUrl || serverConfig?.nvidiaBaseUrl || 'https://integrate.api.nvidia.com/v1';
                } else if (prov === 'google') {
                  nextKey = updatedConfig.googleApiKey !== undefined ? updatedConfig.googleApiKey : (process.env.GEMINI_API_KEY || '');
                  nextModel = updatedConfig.googleModelId || 'gemini-3-flash-preview';
                } else if (prov === 'openai') {
                  nextKey = updatedConfig.openaiApiKey !== undefined ? updatedConfig.openaiApiKey : '';
                  nextModel = updatedConfig.openaiModelId || 'gpt-4o';
                }

                setTempConfig({
                  ...updatedConfig,
                  provider: prov,
                  modelId: nextModel,
                  apiKey: nextKey,
                  nvidiaBaseUrl: nextBaseUrl
                });
              }}
            >
              <option value="google" className="bg-surface-container-highest">Google Gemini</option>
              <option value="openai" className="bg-surface-container-highest">OpenAI</option>
              <option value="nvidia" className="bg-surface-container-highest">NVIDIA (Meta Llama)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">{t('common.model_name')}</label>
            {tempConfig.provider === 'nvidia' ? (
              <div className="space-y-2">
                <select
                  className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer"
                  value={
                    ['meta/llama-3.3-70b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct', 'meta/llama-3.1-405b-instruct', 'meta/llama-3.1-70b-instruct', 'meta/llama-3.1-8b-instruct', 'mistralai/mistral-large-2-instruct'].includes(tempConfig.modelId)
                      ? tempConfig.modelId
                      : 'custom'
                  }
                  onChange={e => {
                    const selected = e.target.value;
                    let targetModel = tempConfig.modelId;
                    if (selected !== 'custom') {
                      targetModel = selected;
                    } else {
                      targetModel = 'meta/llama-3.3-70b-instruct';
                    }
                    setTempConfig({ ...tempConfig, modelId: targetModel, nvidiaModelId: targetModel });
                  }}
                >
                  <option value="meta/llama-3.3-70b-instruct">Llama 3.3 70B Instruct (Mới nhất & khuyên dùng 🌟)</option>
                  <option value="nvidia/llama-3.1-nemotron-70b-instruct">Nemotron 70B Instruct (Đối thoại siêu tự nhiên)</option>
                  <option value="meta/llama-3.1-405b-instruct">Llama 3.1 405B Instruct (Sức mạnh tối đa)</option>
                  <option value="meta/llama-3.1-70b-instruct">Llama 3.1 70B Instruct (Cân bằng tốt)</option>
                  <option value="meta/llama-3.1-8b-instruct">Llama 3.1 8B Instruct (Cực nhanh & nhẹ)</option>
                  <option value="mistralai/mistral-large-2-instruct">Mistral Large 2 (Đa ngôn ngữ mượt)</option>
                  <option value="custom">✍️ Tùy chọn (Nhập mã model bất kỳ...)</option>
                </select>
                
                {(!['meta/llama-3.3-70b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct', 'meta/llama-3.1-405b-instruct', 'meta/llama-3.1-70b-instruct', 'meta/llama-3.1-8b-instruct', 'mistralai/mistral-large-2-instruct'].includes(tempConfig.modelId)) && (
                  <div className="relative animate-fade-in mt-1">
                    <input 
                      className="w-full bg-surface-container-highest border border-primary/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/50 transition-all font-mono"
                      placeholder="e.g. meta/llama-3.3-70b-instruct"
                      value={tempConfig.modelId}
                      onChange={e => setTempConfig({...tempConfig, modelId: e.target.value, nvidiaModelId: e.target.value})}
                    />
                    <span className="absolute right-3 top-3 text-[10px] text-primary/70 uppercase tracking-wider font-extrabold">
                      Tên model tùy chỉnh
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <input 
                className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="e.g. gemini-1.5-flash or gpt-4o"
                value={tempConfig.modelId}
                onChange={e => {
                  const val = e.target.value;
                  const updated: Partial<AIConfig> = { modelId: val };
                  if (tempConfig.provider === 'google') {
                    updated.googleModelId = val;
                  } else if (tempConfig.provider === 'openai') {
                    updated.openaiModelId = val;
                  }
                  setTempConfig({ ...tempConfig, ...updated });
                }}
              />
            )}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">{t('common.api_key')}</label>
          <input 
            type="password"
            className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/50 transition-all"
            placeholder={tempConfig.provider === 'nvidia' ? "Điền NVIDIA API Key (Để trống nếu dùng cấu hình .env)..." : "Enter your API Key..."}
            value={tempConfig.apiKey}
            onChange={e => {
              const val = e.target.value;
              const updated: Partial<AIConfig> = { apiKey: val };
              if (tempConfig.provider === 'google') {
                updated.googleApiKey = val;
              } else if (tempConfig.provider === 'nvidia') {
                updated.nvidiaApiKey = val;
              } else if (tempConfig.provider === 'openai') {
                updated.openaiApiKey = val;
              }
              setTempConfig({ ...tempConfig, ...updated });
            }}
          />
          {tempConfig.provider === 'nvidia' && (
            <p className="text-[10px] text-on-surface-variant italic px-1">
              {serverConfig?.nvidiaConfigured ? (
                <span className="text-emerald-400 font-bold">
                  * Có phát hiện NVIDIA_API_KEY trong cấu hình .env máy chủ (Có thể để trống trường này).
                </span>
              ) : (
                <span className="text-amber-400 font-bold">
                  * Chưa cài đặt NVIDIA_API_KEY ở .env máy chủ. Bạn có thể tự điền khoá vào đây để sử dụng.
                </span>
              )}
            </p>
          )}
        </div>

        {tempConfig.provider === 'nvidia' && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">NVIDIA Base URL</label>
            <input 
              className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="e.g. https://integrate.api.nvidia.com/v1 (Để trống nếu dùng cấu hình .env)"
              value={tempConfig.nvidiaBaseUrl || ''}
              onChange={e => setTempConfig({...tempConfig, nvidiaBaseUrl: e.target.value})}
            />
          </div>
        )}

        {tempConfig.provider === 'google' && (
          <div className="pt-4 border-t border-outline-variant/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <Key size={16} className="text-secondary" />
                  Xoay vòng API Key tự động (Gemini)
                </h4>
                <p className="text-xs text-on-surface-variant">Lưu nhiều API key để tự động đổi khi hết lượt gọi miễn phí.</p>
              </div>
              <button
                type="button"
                onClick={() => setTempConfig({ ...tempConfig, useRotation: !tempConfig.useRotation })}
                className={cn(
                  "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  tempConfig.useRotation ? "bg-primary" : "bg-surface-container-highest"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out",
                    tempConfig.useRotation ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {tempConfig.useRotation && (
              <div className="space-y-4 pt-2">
                {/* Add Key Form */}
                <div className="bg-surface-container-highest/50 p-4 rounded-2xl border border-outline-variant/20 space-y-3">
                  <h5 className="text-xs font-bold text-on-surface uppercase tracking-wider">Thêm API Key mới vào danh sách</h5>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="password"
                      className="flex-1 bg-surface-container-highest border-none rounded-xl px-4 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-outline"
                      placeholder="Dán API Key Gemini của bạn..."
                      value={newPoolKey}
                      onChange={e => setNewPoolKey(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-on-surface-variant whitespace-nowrap">Giới hạn/ngày:</label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        className="w-16 bg-surface-container-highest border-none rounded-xl px-2 py-2 text-sm text-on-surface text-center focus:ring-2 focus:ring-primary/50 transition-all"
                        value={newPoolKeyLimit}
                        onChange={e => setNewPoolKeyLimit(parseInt(e.target.value) || 20)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddKeyToPool}
                      disabled={!newPoolKey.trim()}
                      className="bg-secondary text-background px-4 py-2 rounded-xl text-xs font-bold hover:shadow-lg disabled:opacity-40 disabled:hover:shadow-none transition-all cursor-pointer"
                    >
                      Thêm vào Pool
                    </button>
                  </div>
                  <p className="text-[10px] text-on-surface-variant italic">
                    * Gemini API Key ở chế độ miễn phí thường giới hạn khoảng 15 request/phút. Bạn nên đặt giới hạn tối đa ngày khoảng 20-50 để dùng an toàn.
                  </p>
                </div>

                {/* Pool List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-on-surface-variant">Danh sách API Key ({tempConfig.geminiKeysPool?.length || 0})</span>
                    {(tempConfig.geminiKeysPool?.length || 0) > 0 && (
                      <button
                        type="button"
                        onClick={handleResetPoolUsage}
                        className="text-[10px] text-primary hover:underline flex items-center gap-1 font-bold cursor-pointer"
                      >
                        <RefreshCw size={10} />
                        Reset toàn bộ lượt dùng
                      </button>
                    )}
                  </div>

                  {(tempConfig.geminiKeysPool || []).length === 0 ? (
                    <div className="text-center p-6 bg-surface-container-highest/20 rounded-2xl border border-dashed border-outline-variant/30 text-xs text-on-surface-variant">
                      Chưa có API key phụ nào. Vui lòng thêm key ở trên để kích hoạt chế độ xoay vòng.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {(tempConfig.geminiKeysPool || []).map((item, idx) => {
                        const isCurrentlyExhausted = item.usageCount >= (item.maxDailyRequests ?? 20);
                        const isFailed = item.status === 'failed';
                        const isExhausted = item.status === 'exhausted' || isCurrentlyExhausted;

                        return (
                          <div
                            key={item.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-surface-container-highest/40 rounded-xl border border-outline-variant/10 gap-3"
                          >
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-on-surface select-all truncate max-w-[150px] sm:max-w-xs">
                                  {item.key.substring(0, 8)}...{item.key.substring(item.key.length - 4)}
                                </span>
                                
                                {isFailed ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-destructive/10 text-destructive border border-destructive/20">
                                    <AlertCircle size={10} />
                                    Bị lỗi
                                  </span>
                                ) : isExhausted ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                    <AlertTriangle size={10} />
                                    Hết ngày
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">
                                    Sẵn sàng
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-4 text-[10px] text-on-surface-variant">
                                <span>Lượt gọi hôm nay: <strong className="text-on-surface">{item.usageCount}/{item.maxDailyRequests ?? 20}</strong></span>
                                {item.lastUsedDate && (
                                  <span>Dùng gần nhất: {item.lastUsedDate}</span>
                                )}
                              </div>

                              {item.errorMsg && (
                                <p className="text-[9px] text-destructive leading-tight italic bg-destructive/5 p-1 rounded border border-destructive/10 whitespace-pre-wrap">
                                  Chi tiết lỗi: {item.errorMsg}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveKeyFromPool(item.id)}
                              className="text-on-surface-variant hover:text-destructive p-1.5 hover:bg-white/5 rounded-lg transition-colors self-end sm:self-auto cursor-pointer"
                              title="Xóa Key"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="pt-4 flex items-center justify-between">
          <p className="text-[10px] text-on-surface-variant italic max-w-[60%]">
            {t('common.sync_desc')}
          </p>
          <button 
            onClick={handleSaveConfig}
            className={cn(
              "flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all",
              isSaved 
                ? "bg-green-500/20 text-green-500 ring-1 ring-green-500/50" 
                : "bg-primary text-background hover:shadow-lg hover:shadow-primary/20 active:scale-95"
            )}
          >
            {isSaved ? (
              <>
                <CheckCircle2 size={18} />
                <span>{t('common.saved')}</span>
              </>
            ) : (
              <span>{t('common.save_config')}</span>
            )}
          </button>
        </div>

        <div className="pt-6 border-t border-outline-variant/10 space-y-6">
          <h4 className="text-sm font-bold text-on-surface mb-4">{t('common.translation_settings') || 'Translation Settings'}</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">{t('common.translation_provider') || 'Translation Method'}</label>
              <select 
                className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer" 
                value={tempConfig.translationProvider || 'free'}
                onChange={e => setTempConfig({...tempConfig, translationProvider: e.target.value as 'ai' | 'free'})}
              >
                <option value="free" className="bg-surface-container-highest">Free (MyMemory API)</option>
                <option value="ai" className="bg-surface-container-highest">AI Translation (Gemini/OpenAI)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">{t('common.target_language') || 'Target Language'}</label>
              <select 
                className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer" 
                value={tempConfig.translationLanguage || 'vi'}
                onChange={e => setTempConfig({...tempConfig, translationLanguage: e.target.value})}
              >
                <option value="vi" className="bg-surface-container-highest">Tiếng Việt</option>
                <option value="en" className="bg-surface-container-highest">English</option>
                <option value="fr" className="bg-surface-container-highest">Français</option>
                <option value="ja" className="bg-surface-container-highest">日本語</option>
                <option value="ko" className="bg-surface-container-highest">한국어</option>
                <option value="zh" className="bg-surface-container-highest">中文</option>
              </select>
            </div>
          </div>
          
          {tempConfig.translationProvider === 'free' && (
            <p className="text-[10px] text-on-surface-variant italic px-1">
              * Free method uses MyMemory API. It's free but might be less accurate than AI for complex sentences.
            </p>
          )}
        </div>
      </section>

      {/* Data Management Section */}
      <section className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/20">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <History size={24} className="text-primary" />
          {t('common.data_management')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-6 bg-surface-container-highest rounded-2xl border border-outline-variant/10">
            <div>
              <p className="text-sm font-bold text-on-surface">{t('common.clear_history')}</p>
              <p className="text-[10px] text-on-surface-variant mt-1">{t('common.clear_history_desc')}</p>
            </div>
            <button 
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  title: t('common.clear_history'),
                  message: t('common.confirm_clear'),
                  onConfirm: () => {
                    safeLocalStorage.removeItem('muse_chat_history');
                    window.location.reload();
                  }
                });
              }}
              className="px-4 py-2 bg-tertiary/10 hover:bg-tertiary/20 text-tertiary rounded-lg text-xs font-bold transition-all"
            >
              {t('common.clear')}
            </button>
          </div>

          <div className="flex items-center justify-between p-6 bg-surface-container-highest rounded-2xl border border-outline-variant/10">
            <div>
              <p className="text-sm font-bold text-on-surface">{t('common.reset_application')}</p>
              <p className="text-[10px] text-on-surface-variant mt-1">{t('common.factory_reset_desc')}</p>
            </div>
            <button 
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  title: t('common.reset_application'),
                  message: t('common.confirm_reset'),
                  onConfirm: () => {
                    safeLocalStorage.clear();
                    window.location.reload();
                  }
                });
              }}
              className="px-4 py-2 bg-tertiary text-background hover:bg-tertiary/90 rounded-lg text-xs font-bold transition-all"
            >
              {t('common.reset')}
            </button>
          </div>
        </div>
      </section>
    </motion.div>
  );
}

function ThemeOption({ active, label, icon, onClick }: { active: boolean, label: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
        active 
          ? "bg-primary/10 border-primary text-primary" 
          : "bg-surface-container-highest border-outline-variant/20 text-on-surface-variant hover:border-outline-variant"
      )}
    >
      {icon}
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
}

function CharacterCard({ character, onChat, onEdit, onDelete }: { character: Character, onChat: () => void, onEdit: () => void, onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="group bg-surface-container-low rounded-xl overflow-hidden relative transition-all duration-500 hover:translate-y-[-8px] shadow-xl hover:shadow-primary/5">
      <div className="h-48 overflow-hidden relative">
        <img src={character.avatarUrl || null} alt={character.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-transparent to-transparent"></div>
        <div className="absolute top-4 left-4">
          <span className={cn(
            "px-3 py-1 backdrop-blur-md text-[10px] font-bold tracking-widest uppercase rounded-full border",
            character.status === 'Operational' ? "bg-secondary/10 text-secondary border-secondary/20" : "bg-primary/10 text-primary border-primary/20"
          )}>
            {character.status}
          </span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-4 right-4 p-2 bg-black/20 backdrop-blur-md text-white/60 hover:text-red-400 rounded-full opacity-0 group-hover:opacity-100 transition-all"
          title={t('common.delete_persona')}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="p-6 relative">
        <div className="absolute -top-10 left-6 w-20 h-20 rounded-xl overflow-hidden border-4 border-surface-container-low shadow-2xl">
          <img src={character.avatarUrl || null} alt="Avatar" className="w-full h-full object-cover" />
        </div>
        <div className="pt-10">
          <h4 className="font-headline text-xl sm:text-2xl font-bold text-on-surface mb-1">{character.name}</h4>
          <p className="text-on-surface-variant text-sm line-clamp-2 leading-relaxed mb-6 italic">{character.description}</p>
          <div className="flex items-center justify-between border-t border-white/5 pt-4">
            <div className="flex gap-4">
              <button onClick={onChat} className="text-on-surface-variant hover:text-primary transition-colors" title={t('common.chat')}>
                <MessageSquare size={20} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-on-surface-variant hover:text-primary transition-colors" title={t('common.edit')}>
                <Settings size={20} />
              </button>
            </div>
            <span className="font-headline text-xs font-bold text-secondary tracking-widest">{character.version}</span>
          </div>
        </div>
      </div>
    </div>
  );
}


function ChatView({ 
  character, 
  onUpdateCharacter,
  history, 
  onUpdateHistory, 
  isSidebarCollapsed, 
  aiConfig, 
  onUpdateAiConfig,
  userAvatar,
  setConfirmModal
}: { 
  character: Character, 
  onUpdateCharacter: (c: Character) => void,
  history: Message[], 
  onUpdateHistory: (h: Message[]) => void, 
  isSidebarCollapsed: boolean, 
  aiConfig: AIConfig, 
  onUpdateAiConfig?: (cfg: AIConfig) => void,
  userAvatar: string,
  setConfirmModal: (modal: any) => void
}) {
  const { t, i18n } = useTranslation();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Selection translation states
  const [selectionInfo, setSelectionInfo] = useState<{
    text: string;
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);
  const [activeTranslation, setActiveTranslation] = useState<string | null>(null);
  const [isTranslatingSelection, setIsTranslatingSelection] = useState(false);
  const [copiedSelection, setCopiedSelection] = useState(false);

  useEffect(() => {
    const handleSelectionChange = (e: MouseEvent | TouchEvent) => {
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection) return;

        const selectedText = selection.toString().trim();
        if (!selectedText) {
          const target = e.target as HTMLElement;
          if (!target.closest('.translation-popup')) {
            setSelectionInfo(null);
            setActiveTranslation(null);
          }
          return;
        }

        const container = document.getElementById('chat-messages-container');
        if (container && !container.contains(selection.anchorNode)) {
          return;
        }

        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          setSelectionInfo({
            text: selectedText,
            x: rect.left + rect.width / 2,
            y: rect.top,
            visible: true
          });
        }
      }, 50);
    };

    const handleDocumentClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.translation-popup')) {
        const selection = window.getSelection();
        const selectedText = selection ? selection.toString().trim() : '';
        if (!selectedText) {
          setSelectionInfo(null);
          setActiveTranslation(null);
        }
      }
    };

    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('touchend', handleSelectionChange);
    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('touchstart', handleDocumentClick);

    return () => {
      document.removeEventListener('mouseup', handleSelectionChange);
      document.removeEventListener('touchend', handleSelectionChange);
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('touchstart', handleDocumentClick);
    };
  }, []);

  const handleTranslateSelection = async () => {
    if (!selectionInfo || !selectionInfo.text) return;
    setIsTranslatingSelection(true);
    setActiveTranslation(null);
    try {
      const targetLang = aiConfig.translationLanguage || 'vi';
      const result = await translateText(selectionInfo.text, targetLang, aiConfig, onUpdateAiConfig);
      setActiveTranslation(result);
    } catch (err) {
      console.error("Selection translation error:", err);
      setActiveTranslation("Error translating text. Please try again.");
    } finally {
      setIsTranslatingSelection(false);
    }
  };

  const handleCopySelectionTranslation = () => {
    if (!activeTranslation) return;
    navigator.clipboard.writeText(activeTranslation);
    setCopiedSelection(true);
    setTimeout(() => setCopiedSelection(false), 2000);
  };

  const playSpeechText = (speechText: string, langType: 'src' | 'target') => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText);
    const voices = window.speechSynthesis.getVoices();
    if (langType === 'src') {
      const bestEN = getBestEnglishVoice(voices);
      if (bestEN) utterance.voice = bestEN;
      utterance.lang = 'en-US';
    } else {
      const bestVI = voices.find(v => v.lang.startsWith('vi'));
      if (bestVI) utterance.voice = bestVI;
      utterance.lang = 'vi-VN';
    }
    window.speechSynthesis.speak(utterance);
  };

  const isEnglishResponse = (text: string) => {
    const vietnameseChars = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
    return !vietnameseChars.test(text);
  };

  const handleSpeak = (text: string, messageId: string) => {
    if (isSpeaking === messageId) {
      window.speechSynthesis.cancel();
      setIsSpeaking(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to find the selected voice
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice: SpeechSynthesisVoice | undefined;
    
    if (character.voiceId) {
      selectedVoice = voices.find(v => v.voiceURI === character.voiceId);
    }
    
    // Fallback logic for English if no voice selected or selected voice not found on this device
    if (!selectedVoice && isEnglishResponse(text)) {
      const bestEN = getBestEnglishVoice(voices);
      if (bestEN) {
        selectedVoice = bestEN;
      }
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => setIsSpeaking(null);
    utterance.onerror = () => setIsSpeaking(null);
    
    setIsSpeaking(messageId);
    window.speechSynthesis.speak(utterance);
  };

  const handleTranslate = async (text: string, messageId: string) => {
    if (isTranslating) return;
    
    const msg = history.find(m => m.id === messageId);
    if (msg?.translation) return;

    setIsTranslating(messageId);
    try {
      const targetLang = aiConfig.translationLanguage || 'vi';
      const translated = await translateText(text, targetLang, aiConfig, onUpdateAiConfig);
      
      const newHistory = history.map(m => 
        m.id === messageId ? { ...m, translation: translated } : m
      );
      onUpdateHistory(newHistory);
    } catch (err) {
      console.error("Translation error:", err);
    } finally {
      setIsTranslating(null);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(t('common.speech_not_supported') || "Your browser does not support speech recognition.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const emojis = ['😊', '😂', '🥰', '😎', '🤔', '😢', '🔥', '✨', '👍', '❤️', '🤖', '🌌'];

  const addEmoji = (emoji: string) => {
    setInput(prev => prev + emoji);
    setShowEmoji(false);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    setError(null);

    const userMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    const updatedHistory = [...history, userMsg];
    onUpdateHistory(updatedHistory);
    setInput('');
    setIsStreaming(true);

    try {
      let fullText = '';
      const stream = streamChat(character, history, input, aiConfig, onUpdateAiConfig);
      
      const modelMsgId = `msg-${Date.now() + 1}-${Math.random().toString(36).substr(2, 9)}`;
      let modelMsg: Message = {
        id: modelMsgId,
        role: 'model',
        content: '',
        timestamp: Date.now()
      };

      onUpdateHistory([...updatedHistory, modelMsg]);

      for await (const chunk of stream) {
        fullText += chunk;
        const { emotion, content, correction, suggestions } = parseResponse(fullText);
        modelMsg = {
          ...modelMsg,
          content: content,
          emotion: emotion,
          correction: correction,
          suggestions: suggestions
        };
        onUpdateHistory([...updatedHistory, modelMsg]);
      }
    } catch (err: any) {
      console.error("Chat Error:", err);
      setError(err.message || "An unexpected error occurred.");
      // Remove the empty model message if it was added
      onUpdateHistory(updatedHistory);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 relative overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar space-y-6 sm:space-y-8 px-3 sm:px-4 py-4 sm:py-8">
        <div className="max-w-4xl mx-auto w-full">
          {history.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center opacity-40">
              <Sparkles size={60} className="mb-4 text-primary" />
              <p className="text-base sm:text-lg font-headline">{t('common.connection_open')}</p>
              <p className="text-sm">{t('common.begin_sync', { name: character.name })}</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-sm flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in zoom-in duration-300">
              <div className="flex items-center gap-3">
                <Bell size={18} className="flex-shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
              <button 
                onClick={() => {
                  // Re-send the last user message
                  const lastUserMsg = history.filter(m => m.role === 'user').pop();
                  if (lastUserMsg) {
                    setInput(lastUserMsg.content);
                    // We need to remove the last user message from history so handleSend can re-add it
                    onUpdateHistory(history.filter(m => m.id !== lastUserMsg.id));
                    // Use a timeout to ensure state updates before calling handleSend
                    setTimeout(() => handleSend(), 0);
                  }
                }}
                className="px-4 py-2 bg-destructive text-white text-xs font-bold rounded-full hover:bg-destructive/90 transition-all active:scale-95 flex-shrink-0"
              >
                {t('common.retry') || 'Retry'}
              </button>
            </div>
          )}

          <div id="chat-messages-container" className="space-y-8">
            {history.map((msg, index) => (
              <div key={`${msg.id}-${index}`} className={cn(
                "flex items-start gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500",
                msg.role === 'user' ? "flex-row-reverse ml-auto" : ""
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 shadow-md border-2",
                  msg.role === 'user' ? "border-primary/20" : "border-secondary/20"
                )}>
                  {msg.role === 'user' ? (
                    <img src={userAvatar || null} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <img src={character.avatarUrl || null} alt={character.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className={cn(
                  "flex flex-col gap-1.5 max-w-[85%] sm:max-w-[75%]",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}>
                  {msg.emotion && (
                    <div className="flex items-center justify-between w-full px-1">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-black text-secondary/70 italic">
                        <Sparkles size={10} className="animate-pulse" />
                        {msg.emotion}
                      </div>
                      {msg.role === 'model' && (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => handleTranslate(msg.content, msg.id)}
                            className={cn(
                              "p-1 rounded-full transition-all hover:bg-white/10",
                              isTranslating === msg.id ? "text-primary animate-spin" : "text-on-surface-variant"
                            )}
                            title="Translate"
                            disabled={!!msg.translation}
                          >
                            <Globe size={14} />
                          </button>
                          <button 
                            onClick={() => handleSpeak(msg.content, msg.id)}
                            className={cn(
                              "p-1 rounded-full transition-all hover:bg-white/10",
                              isSpeaking === msg.id ? "text-primary animate-pulse" : "text-on-surface-variant"
                            )}
                            title="Listen"
                          >
                            {isSpeaking === msg.id ? <VolumeX size={14} /> : <Volume2 size={14} />}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className={cn(
                    "p-4 sm:p-5 rounded-2xl text-sm leading-relaxed shadow-sm transition-all",
                    msg.role === 'user' 
                      ? "bg-gradient-to-br from-primary to-primary-dim text-background rounded-tr-none font-medium" 
                      : "bg-surface-container-highest text-on-surface rounded-tl-none border border-white/5"
                  )}>
                    {msg.role === 'model' && msg.content === '' && isStreaming && index === history.length - 1 ? (
                      <div className="flex gap-1 items-center py-1">
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                          transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                          className="w-1.5 h-1.5 bg-primary rounded-full" 
                        />
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                          transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                          className="w-1.5 h-1.5 bg-primary rounded-full" 
                        />
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                          transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                          className="w-1.5 h-1.5 bg-primary rounded-full" 
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="markdown-body">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>

                        {msg.translation && (
                          <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-tertiary uppercase tracking-wider">
                              <Globe size={12} />
                              {t('common.translation') || 'Translation'}
                            </div>
                            <p className="text-xs text-on-surface-variant bg-tertiary/5 p-2 rounded-lg italic border-l-2 border-tertiary">
                              {msg.translation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === 'model' && msg.correction && (
                    <motion.div 
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full mt-2 self-stretch"
                    >
                      <div className="flex flex-col gap-2 p-4 rounded-2xl bg-amber-500/10 text-on-surface border border-amber-500/25 shadow-md text-xs relative overflow-hidden backdrop-blur-[2px]">
                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                        <div className="flex items-center gap-2 font-bold text-amber-500 uppercase tracking-widest text-[10px] select-none">
                          <CheckCircle2 size={13} className="stroke-[2.5]" />
                          <span>{isEnglishResponse(msg.content) ? 'Spelling & Grammar Correction' : 'Chỉnh sửa lỗi chính tả & ngữ pháp'}</span>
                        </div>
                        <div className="text-on-surface-variant leading-relaxed pl-1">
                          <span className="opacity-75">{isEnglishResponse(msg.content) ? 'Correction:' : 'Sửa lại cho đúng:'}</span> <span className="text-amber-200 font-medium bg-amber-500/15 px-2 py-1 rounded-lg border border-amber-500/10 italic select-all inline-block mt-1">"{msg.correction}"</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {msg.role === 'model' && msg.suggestions && msg.suggestions.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full mt-3 self-stretch flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-1.5 font-bold text-secondary/90 uppercase tracking-widest text-[9px] pl-1 select-none">
                        <Sparkles size={11} className="stroke-[2.5] text-secondary animate-pulse" />
                        <span>{isEnglishResponse(msg.content) ? 'Suggested Replies' : 'Gợi ý câu trả lời tiếp theo'}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {msg.suggestions.map((suggestion, sIdx) => (
                          <button 
                            key={sIdx}
                            onClick={() => {
                              setInput(suggestion);
                              if (inputRef.current) {
                                inputRef.current.focus();
                                // Auto-resize textarea
                                setTimeout(() => {
                                  if (inputRef.current) {
                                    inputRef.current.style.height = 'auto';
                                    const maxHeight = window.innerWidth < 640 ? 128 : 192;
                                    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, maxHeight)}px`;
                                  }
                                }, 50);
                              }
                            }}
                            className="text-xs bg-secondary/15 hover:bg-secondary/25 text-secondary hover:text-white px-3.5 py-1.5 rounded-full transition-all border border-secondary/25 hover:border-secondary/50 active:scale-95 text-left leading-snug font-medium cursor-pointer shadow-sm backdrop-blur-[1px]"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-6 bg-background/80 backdrop-blur-md border-t border-outline-variant/10 flex-shrink-0 pb-[env(safe-area-inset-bottom)] z-10">
        <div className="max-w-4xl mx-auto relative">
          <div className="flex items-end gap-1.5 sm:gap-3 bg-surface-container-highest p-1 sm:p-2 rounded-2xl shadow-xl ring-1 ring-white/5 focus-within:ring-primary/40 transition-all relative">
            <div className="relative">
              <button 
                onClick={() => setShowEmoji(!showEmoji)}
                className={cn(
                  "p-2 sm:p-3 transition-colors",
                  showEmoji ? "text-primary" : "text-on-surface-variant hover:text-primary"
                )}
              >
                <Smile size={20} />
              </button>
              
              <button 
                onClick={toggleListening}
                className={cn(
                  "p-2 sm:p-3 transition-colors",
                  isListening ? "text-destructive animate-pulse" : "text-on-surface-variant hover:text-primary"
                )}
                title={isListening ? (t('common.stop_voice') || "Stop Listening") : (t('common.start_voice') || "Start Voice Input")}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              <AnimatePresence>
                {showEmoji && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute bottom-full left-0 mb-4 p-2 sm:p-3 bg-surface-container-high border border-outline-variant/30 rounded-2xl shadow-2xl grid grid-cols-4 sm:grid-cols-6 gap-1 sm:gap-2 z-50 backdrop-blur-xl min-w-[180px] sm:min-w-[280px]"
                  >
                    {emojis.map((emoji, index) => (
                      <button 
                        key={`${emoji}-${index}`} 
                        onClick={() => addEmoji(emoji)}
                        className="w-10 h-10 flex items-center justify-center text-xl hover:bg-white/10 rounded-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <textarea 
              ref={inputRef}
              className="flex-1 bg-transparent border-none text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 text-sm font-medium py-2 resize-none max-h-32 sm:max-h-48 min-h-[40px] custom-scrollbar" 
              placeholder={t('common.speak_with', { name: character.name })}
              value={input}
              rows={1}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                const maxHeight = window.innerWidth < 640 ? 128 : 192;
                e.target.style.height = `${Math.min(e.target.scrollHeight, maxHeight)}px`;
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                  e.currentTarget.style.height = 'auto';
                }
              }}
            />
            <button 
              onClick={handleSend}
              disabled={isStreaming}
              className="flex items-center justify-center w-10 h-10 sm:w-auto sm:px-6 sm:py-3 bg-gradient-to-br from-primary to-primary-dim rounded-xl text-background font-bold text-sm scale-95 active:scale-90 transition-transform hover:shadow-lg disabled:opacity-50"
            >
              <Send size={18} className="sm:mr-2" />
              <span className="hidden sm:inline">{isStreaming ? t('common.thinking') : t('common.send')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Selection Translator */}
      <AnimatePresence>
        {selectionInfo && selectionInfo.visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            style={{
              position: 'fixed',
              left: `${selectionInfo.x}px`,
              top: `${selectionInfo.y}px`,
            }}
            className="translation-popup z-[999] -translate-x-1/2 -translate-y-[115%] flex flex-col items-center pointer-events-auto filter drop-shadow-xl"
          >
            {!activeTranslation && !isTranslatingSelection ? (
              <button
                onClick={handleTranslateSelection}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-high border border-outline-variant/30 text-xs text-on-surface hover:text-primary rounded-full transition-all hover:bg-neutral-800 font-bold hover:scale-105 shadow-lg shadow-black/40"
              >
                <Languages size={13} className="text-secondary animate-pulse" />
                <span>{t('common.translate_selection') || 'Dịch đoạn văn'}</span>
              </button>
            ) : (
              <div className="w-80 max-w-sm bg-surface-container-high border border-outline-variant/30 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl relative">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-secondary/70">
                  <span className="flex items-center gap-1">
                    <Sparkles size={10} className="text-primary animate-pulse" />
                    {t('common.translation_result') || 'Kết quả dịch'}
                  </span>
                  <button 
                    onClick={() => {
                      setSelectionInfo(null);
                      setActiveTranslation(null);
                    }}
                    className="p-1 hover:bg-white/5 rounded-full text-on-surface-variant hover:text-on-surface"
                  >
                    <X size={12} />
                  </button>
                </div>

                {isTranslatingSelection ? (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw size={20} className="text-primary animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <p className="text-[11px] text-on-surface-variant/70 italic line-clamp-2 select-none">
                        "{selectionInfo.text}"
                      </p>
                      <div className="p-3 bg-background/50 rounded-xl border border-outline-variant/10 text-xs leading-relaxed text-on-surface max-h-40 overflow-y-auto custom-scrollbar font-sans select-text">
                        {activeTranslation}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-outline-variant/15 pt-2 mt-1">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => playSpeechText(selectionInfo.text, 'src')}
                          className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 active:scale-95 rounded-lg text-[9px] font-medium text-on-surface transition-all cursor-pointer"
                          title="Listen source text"
                        >
                          <Volume2 size={10} />
                          <span>Gốc (EN)</span>
                        </button>
                        
                        <button
                          onClick={() => playSpeechText(activeTranslation!, 'target')}
                          className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 active:scale-95 rounded-lg text-[9px] font-medium text-on-surface transition-all cursor-pointer"
                          title="Listen translated text"
                        >
                          <Volume2 size={10} />
                          <span>Dịch (VI)</span>
                        </button>
                      </div>

                      <button
                        onClick={handleCopySelectionTranslation}
                        className="flex items-center gap-1 px-2.5 py-1 bg-primary text-background hover:bg-primary/90 active:scale-95 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer"
                      >
                        {copiedSelection ? (
                          <>
                            <Check size={10} />
                            <span>Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy size={10} />
                            <span>Sao chép</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
                {/* Visual arrow indicator */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1.5 w-3 h-3 bg-surface-container-high border-r border-b border-outline-variant/30 rotate-45 z-[-1]" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InputGroup({ label, placeholder, value, onChange }: { label: string, placeholder: string, value?: string, onChange: (v: string) => void }) {
  return (
    <div className="group">
      <label className="block text-sm font-semibold text-on-surface-variant mb-2 ml-1">{label}</label>
      <input 
        className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/50 placeholder:text-outline transition-all" 
        placeholder={placeholder} 
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function TextAreaGroup({ label, placeholder, value, onChange, rows }: { label: string, placeholder: string, value?: string, onChange: (v: string) => void, rows: number }) {
  return (
    <div className="group">
      <label className="block text-sm font-semibold text-on-surface-variant mb-2 ml-1">{label}</label>
      <textarea 
        className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/50 placeholder:text-outline transition-all resize-none" 
        placeholder={placeholder} 
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectGroup({ label, value, onChange, options }: { label: string, value: string, onChange: (v: string) => void, options: { value: string, label: string, disabled?: boolean }[] }) {
  return (
    <div className="group">
      <label className="block text-sm font-semibold text-on-surface-variant mb-2 ml-1">{label}</label>
      <select 
        className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer" 
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map((opt, index) => (
          <option 
            key={`${opt.value}-${index}`} 
            value={opt.value} 
            disabled={opt.disabled}
            className="bg-surface-container-highest text-on-surface"
          >
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function VoiceSelector({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const updateVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const bestEN = getBestEnglishVoice(voices);
  
  // Check if current value exists in current device voices
  const voiceExists = voices.some(v => v.voiceURI === value);

  const options = [
    { value: '', label: `✨ Recommended (${bestEN?.name || 'Default English'})` },
    ...voices
      .filter(v => v.lang.startsWith('vi') || v.lang.startsWith('en'))
      .sort((a, b) => {
        // Vietnamese first, then English
        if (a.lang.startsWith('vi') && !b.lang.startsWith('vi')) return -1;
        if (!a.lang.startsWith('vi') && b.lang.startsWith('vi')) return 1;
        
        // Secondary sort: prioritize recommended English voice for this device
        const isARec = a.voiceURI === bestEN?.voiceURI;
        const isBRec = b.voiceURI === bestEN?.voiceURI;
        if (isARec && !isBRec) return -1;
        if (!isARec && isBRec) return 1;
        
        return a.name.localeCompare(b.name);
      })
      .map(v => ({ 
        value: v.voiceURI, 
        label: `${v.lang.startsWith('vi') ? '🇻🇳' : '🇺🇸'} ${v.name}${v.voiceURI === bestEN?.voiceURI ? ' (Device Choice)' : ''}` 
      })),
    { value: 'divider', label: '──────────', disabled: true },
    ...voices
      .filter(v => !v.lang.startsWith('vi') && !v.lang.startsWith('en'))
      .map(v => ({ value: v.voiceURI, label: `🌐 ${v.name} (${v.lang})` }))
  ];

  return (
    <div className="space-y-1">
      <SelectGroup 
        label={t('common.voice_setting') || 'Character Voice'} 
        value={value} 
        onChange={onChange} 
        options={options} 
      />
      {!voiceExists && value !== '' && (
        <p className="text-[10px] text-tertiary italic ml-1">
          ⚠️ Current voice setting is not available on this device. Using recommended fallback.
        </p>
      )}
    </div>
  );
}
