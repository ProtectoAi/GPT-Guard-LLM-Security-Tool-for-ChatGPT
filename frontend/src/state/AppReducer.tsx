import { Action, AppState } from './AppProvider';

// Define the reducer function
export const appStateReducer = (state: AppState, action: Action): AppState => {
    switch (action.type) {
        case 'TOGGLE_CHAT_HISTORY':
            return { ...state, isChatHistoryOpen: !state.isChatHistoryOpen };
        case 'UPDATE_CURRENT_CHAT':
            return { ...state, currentChat: action.payload };
        case 'UPDATE_PUBLIC_CURRENT_CHAT':
            return { ...state, publicCurrentChat: action.payload };
        case 'UPDATE_CHAT_HISTORY_LOADING_STATE':
            return { ...state, chatHistoryLoadingState: action.payload };
        case 'UPDATE_CHAT_HISTORY':
            if (!state.chatHistory || !state.currentChat) {
                return state;
            }
            let conversationIndex = state.chatHistory.findIndex(conv => conv.id === action.payload.id);
            if (conversationIndex !== -1) {
                let updatedChatHistory = [...state.chatHistory];
                updatedChatHistory[conversationIndex] = state.currentChat
                return { ...state, chatHistory: updatedChatHistory }
            } else {
                return { ...state, chatHistory: [...state.chatHistory, action.payload] };
            }
        case 'UPDATE_PUBLIC_CHAT_HISTORY':
            if (!state.publicChatHistory || !state.publicCurrentChat) {
                return state;
            }
            let conversationIndex1 = state.publicChatHistory.findIndex(conv => conv.id === action.payload.id);
            if (conversationIndex1 !== -1) {
                let updatedChatHistory1 = [...state.publicChatHistory];
                updatedChatHistory1[conversationIndex1] = state.publicCurrentChat
                return { ...state, publicChatHistory: updatedChatHistory1 }
            } else {
                return { ...state, publicChatHistory: [...state.publicChatHistory, action.payload] };
            }
        case 'UPDATE_CHAT_TITLE':
            if (!state.chatHistory) {
                return { ...state, chatHistory: [] };
            }
            let updatedChats = state.chatHistory.map(chat => {
                if (chat.id === action.payload.id) {
                    if (state.currentChat?.id === action.payload.id) {
                        state.currentChat.title = action.payload.title;
                    }
                    return { ...chat, title: action.payload.title };
                }
                return chat;
            });
            return { ...state, chatHistory: updatedChats };
        case 'DELETE_CHAT_ENTRY':
            if (!state.chatHistory) {
                return { ...state, chatHistory: [] };
            }
            let filteredChat = state.chatHistory.filter(chat => chat.id !== action.payload);
            state.currentChat = null;
            return { ...state, chatHistory: filteredChat };
        case 'DELETE_CHAT_HISTORY':
            return { ...state, chatHistory: [], filteredChatHistory: [], currentChat: null };
        case 'DELETE_CURRENT_CHAT_MESSAGES':
            if (!state.currentChat || !state.chatHistory) {
                return state;
            }
            const updatedCurrentChat = {
                ...state.currentChat,
                messages: []
            };
            return {
                ...state,
                currentChat: updatedCurrentChat
            };
        case 'FETCH_CHAT_HISTORY':
            return { ...state, chatHistory: action.payload };
        case 'FETCH_PUBLIC_CHAT_HISTORY':
            return { ...state, publicChatHistory: action.payload };
        case 'SET_POSTGRESDB_STATUS':
            return { ...state, isPostgresDBAvailable: action.payload };
        case 'SIGNUP':
            return { ...state, signup: action.payload }
        case 'TRAINING_STATUS':
            return { ...state, trainingStatus: action.payload }
        case 'DELETE_PUBLIC_CURRENT_CHAT_MESSAGES':
            if (!state.publicCurrentChat || !state.publicChatHistory) {
                return state;
            }
            const updatedCurrentChatPublic = {
                ...state.publicCurrentChat,
                messages: []
            };
            return {
                ...state,
                publicCurrentChat: updatedCurrentChatPublic
            }
        case 'UPDATE_FILE_UPLOAD':
            return { ...state, uploadFile: action.payload };
        case 'CLEAR_FILE_UPLOAD':
            return {
                ...state, uploadFile: {
                    isFileUploaded: false,
                    inputText: '',
                    text: '',
                    error: '',
                    identified_tokens:null,
                    coloredText:'',
                    isTokens: null
                }
            };
        case 'PUBLIC_UPDATE_FILE_UPLOAD':
            return { ...state, publicUploadFile: action.payload };
        case 'PUBLIC_CLEAR_FILE_UPLOAD':
            return {
                ...state, publicUploadFile: {
                    isFileUploaded: false,
                    inputText: '',
                    text: '',
                    error: '',
                    
                }
            };
        case 'UPDATE_MENUS':
            return { ...state, menus: action.payload };
        case 'DELETE_CURRENT_CHAT_CONVO':
            return { ...state, currentChat: null };
        case 'DELETE_PUBLIC_CURRENT_CHAT_CONVO':
            return { ...state, publicCurrentChat: null };
        case 'IS_LOGGED_IN':
            return { ...state, isLoggedIn: true };
        default:
            return state;
    }
};