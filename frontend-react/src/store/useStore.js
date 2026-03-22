import { create } from 'zustand';
import { api } from '../services/api';
import { generatePlatformUserId } from '../services/wasm';

export const useStore = create((set, get) => ({
  // User state
  user: null,
  isLoading: false,
  error: null,

  // Theme
  theme: 'light',

  // Chat state
  currentChat: null,
  procurements: [],
  messages: [],
  unreadCounts: {},

  // Modal state
  loginModalOpen: false,
  procurementModalOpen: false,
  createProcurementModalOpen: false,
  depositModalOpen: false,
  selectedProcurement: null,

  // Toast state
  toasts: [],

  // Sidebar state (mobile)
  sidebarOpen: false,

  // Actions - User
  loadUser: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const user = await api.getUser(userId);
      set({ user, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
      localStorage.removeItem('userId');
    }
  },

  login: async (data) => {
    set({ isLoading: true, error: null });
    try {
      // Try to find user by email or phone (both are now supported by backend)
      let user = null;
      if (data.email) {
        try {
          user = await api.getUserByEmail(data.email);
        } catch (e) {
          // not found by email, try phone
        }
      }
      if (!user && data.phone) {
        try {
          const normalizedPhone = data.phone.trim().startsWith('+')
            ? data.phone.trim()
            : '+' + data.phone.trim();
          user = await api.getUserByPhone(normalizedPhone);
        } catch (e) {
          // not found by phone either
        }
      }
      if (!user) {
        throw new Error('Пользователь не найден. Проверьте email или телефон, либо зарегистрируйтесь.');
      }
      localStorage.setItem('userId', user.id);
      set({ user, isLoading: false, loginModalOpen: false });
      get().loadProcurements();
      return user;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      get().addToast(error.message, 'error');
      throw error;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const platformUserId = generatePlatformUserId();
      const user = await api.registerUser({ ...data, platform: 'websocket', platform_user_id: platformUserId });
      localStorage.setItem('userId', user.id);
      set({ user, isLoading: false, loginModalOpen: false });
      get().loadProcurements();
      return user;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      get().addToast('Ошибка регистрации', 'error');
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('authToken');
    set({
      user: null,
      currentChat: null,
      messages: [],
      loginModalOpen: true,
    });
  },

  // Actions - Theme
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(newTheme);
  },

  // Actions - Procurements
  loadProcurements: async (params = { status: 'active' }) => {
    set({ isLoading: true });
    try {
      const response = await api.getProcurements(params);
      const procurements = response.results || response;
      set({ procurements, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
      get().addToast('Ошибка загрузки закупок', 'error');
    }
  },

  selectProcurement: async (procurementId) => {
    try {
      const procurement = await api.getProcurement(procurementId);
      set({ selectedProcurement: procurement, procurementModalOpen: true });
    } catch (error) {
      get().addToast('Ошибка загрузки закупки', 'error');
    }
  },

  createProcurement: async (data) => {
    set({ isLoading: true });
    try {
      const procurement = await api.createProcurement(data);
      const procurements = [...get().procurements, procurement];
      set({ procurements, isLoading: false, createProcurementModalOpen: false });
      get().addToast('Закупка успешно создана', 'success');
      return procurement;
    } catch (error) {
      set({ isLoading: false });
      get().addToast('Ошибка создания закупки', 'error');
      throw error;
    }
  },

  joinProcurement: async (procurementId, { amount, quantity, notes }) => {
    const { user } = get();
    if (!user) {
      get().addToast('Необходимо войти в систему', 'error');
      return;
    }
    try {
      await api.joinProcurement(procurementId, {
        user_id: user.id,
        amount,
        quantity: quantity || 1,
        notes: notes || '',
      });
      set({ procurementModalOpen: false });
      get().addToast('Вы присоединились к закупке', 'success');
      get().loadProcurements();
    } catch (error) {
      get().addToast(error.message || 'Ошибка при присоединении', 'error');
    }
  },

  leaveProcurement: async (procurementId) => {
    const { user } = get();
    if (!user) return;
    try {
      await api.leaveProcurement(procurementId, { user_id: user.id });
      get().addToast('Вы вышли из закупки', 'success');
      get().loadProcurements();
    } catch (error) {
      get().addToast(error.message || 'Ошибка при выходе из закупки', 'error');
    }
  },

  stopProcurement: async (procurementId) => {
    try {
      const result = await api.stopProcurement(procurementId);
      get().addToast('Закупка остановлена (стоп-сумма)', 'success');
      get().loadProcurements();
      return result;
    } catch (error) {
      get().addToast(error.message || 'Ошибка при остановке закупки', 'error');
    }
  },

  approveSupplier: async (procurementId, supplierId) => {
    try {
      await api.approveSupplier(procurementId, supplierId);
      get().addToast('Поставщик утверждён', 'success');
      get().loadProcurements();
    } catch (error) {
      get().addToast(error.message || 'Ошибка при утверждении поставщика', 'error');
    }
  },

  closeProcurement: async (procurementId) => {
    try {
      await api.closeProcurement(procurementId);
      get().addToast('Закупка закрыта', 'success');
      set({ procurementModalOpen: false });
      get().loadProcurements();
    } catch (error) {
      get().addToast(error.message || 'Ошибка при закрытии закупки', 'error');
    }
  },

  castVote: async (procurementId, supplierId, comment = '') => {
    const { user } = get();
    if (!user) return;
    try {
      await api.castVote(procurementId, {
        voter_id: user.id,
        supplier_id: supplierId,
        comment,
      });
      get().addToast('Голос учтён', 'success');
    } catch (error) {
      get().addToast(error.message || 'Ошибка при голосовании', 'error');
    }
  },

  // Actions - Chat
  setCurrentChat: (chatId) => {
    set({ currentChat: chatId });
    // Clear unread count for this chat
    const unreadCounts = { ...get().unreadCounts };
    delete unreadCounts[chatId];
    set({ unreadCounts });
  },

  loadMessages: async (procurementId) => {
    try {
      const response = await api.getMessages(procurementId);
      const messages = response.results || response;
      set({ messages });
    } catch (error) {
      get().addToast('Ошибка загрузки сообщений', 'error');
    }
  },

  addMessage: (message) => {
    const messages = [...get().messages, message];
    set({ messages });
  },

  sendMessage: async (text) => {
    const { user, currentChat } = get();
    if (!user || !currentChat) return;

    try {
      const message = await api.sendMessage({
        procurement_id: currentChat,
        user_id: user.id,
        text,
        message_type: 'text',
      });
      get().addMessage(message);
      return message;
    } catch (error) {
      get().addToast('Ошибка отправки сообщения', 'error');
    }
  },

  // Actions - Modals
  openLoginModal: () => set({ loginModalOpen: true }),
  closeLoginModal: () => set({ loginModalOpen: false }),
  openProcurementModal: () => set({ procurementModalOpen: true }),
  closeProcurementModal: () => set({ procurementModalOpen: false, selectedProcurement: null }),
  openCreateProcurementModal: () => set({ createProcurementModalOpen: true }),
  closeCreateProcurementModal: () => set({ createProcurementModalOpen: false }),
  openDepositModal: () => set({ depositModalOpen: true }),
  closeDepositModal: () => set({ depositModalOpen: false }),

  // Actions - Sidebar
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  closeSidebar: () => set({ sidebarOpen: false }),

  // Actions - Toast
  addToast: (message, type = 'info') => {
    const id = Date.now();
    const toast = { id, message, type };
    set({ toasts: [...get().toasts, toast] });
    setTimeout(() => {
      get().removeToast(id);
    }, 3000);
  },

  removeToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));
