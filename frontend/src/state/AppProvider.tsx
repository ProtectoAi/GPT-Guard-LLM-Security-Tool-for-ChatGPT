import React, { createContext, useReducer, ReactNode } from 'react';
import { appStateReducer } from './AppReducer';
import { ChatHistoryLoadingState, PostgresDBHealth, PostgresDBStatus } from '../api';
import { Conversation } from '../api';
import { IS_DB_AVAILABLE } from '../api/authConfig';

export interface AppState {
    isChatHistoryOpen: boolean;
    chatHistoryLoadingState: ChatHistoryLoadingState;
    isPostgresDBAvailable: PostgresDBHealth;
    chatHistory: Conversation[] | null;
    filteredChatHistory: Conversation[] | null;
    currentChat: Conversation | null;
    accessToken: string | null;
    signup: {
        data: {
            email?: string,
        },
        success: boolean | null,
        error: {
            message?: string
        },
    }
    trainingStatus: {
        data: {
            content?: string,
            status?: boolean | null
        },
        success: boolean | null,
        error: {
            message?: string
        },
    }
    publicChatHistory: Conversation[] | null;
    publicCurrentChat: Conversation | null;
    uploadFile: {
        isFileUploaded: boolean,
        fileName?: string,
        inputText?: string,
        text?: string,
        error?: string,
        identified_tokens?:any[] | null;
        coloredText?:string,
        isTokens?:boolean | null
    };
    publicUploadFile: {
        isFileUploaded: boolean,
        fileName?: string,
        inputText?: string,
        text?: string,
        error?: string;
    };
    menus: {
        data?: any[],
        error?: string;
    },
    isLoggedIn?: boolean,
}

export interface Environment {
    AZURE_OPENAI_MODEL: string;
    AZURE_OPENAI_KEY: string;
    AZURE_OPENAI_RESOURCE: string;
    AZURE_OPENAI_ENDPOINT: string;
    VITE_REACT_APP_BACKEND_API_URL: string;
}

export type Action =
    | { type: 'TOGGLE_CHAT_HISTORY' }
    | { type: 'SET_POSTGRESDB_STATUS', payload: PostgresDBHealth }
    | { type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState }
    | { type: 'UPDATE_CURRENT_CHAT', payload: Conversation | null }
    | { type: 'UPDATE_FILTERED_CHAT_HISTORY', payload: Conversation[] | null }
    | { type: 'UPDATE_CHAT_HISTORY', payload: Conversation } // API Call
    | { type: 'UPDATE_CHAT_TITLE', payload: Conversation } // API Call
    | { type: 'DELETE_CHAT_ENTRY', payload: string } // API Call
    | { type: 'DELETE_CHAT_HISTORY' }  // API Call
    | { type: 'DELETE_CURRENT_CHAT_MESSAGES', payload: string }  // API Call
    | { type: 'FETCH_CHAT_HISTORY', payload: Conversation[] | null }  // API Call
    | {
        type: 'SIGNUP', payload: {
            data: {
                email?: string,
            },
            success: boolean | null,
            error: {
                message?: string
            },
        }
    }
    | {
        type: 'TRAINING_STATUS', payload: {
            data: {
                content?: string,
                status?: boolean | null
            },
            success: boolean | null,
            error: {
                message?: string
            },
        }
    }
    | { type: 'FETCH_PUBLIC_CHAT_HISTORY', payload: Conversation[] | null }  // API Call
    | { type: 'UPDATE_PUBLIC_CURRENT_CHAT', payload: Conversation | null }
    | { type: 'UPDATE_PUBLIC_CHAT_HISTORY', payload: Conversation } // API Call
    | { type: 'DELETE_PUBLIC_CURRENT_CHAT_MESSAGES', payload: string }  // API Call
    | {
        type: 'UPDATE_FILE_UPLOAD', payload: {
            isFileUploaded: boolean,
            fileName?: string,
            inputText?: string,
            text?: string,
            error?: string,
            identified_tokens?:any[] | null;
            coloredText?:string,
            isTokens?:boolean | null
        }
    } | {
        type: 'CLEAR_FILE_UPLOAD'
    } | {
        type: 'PUBLIC_UPDATE_FILE_UPLOAD', payload: {
            isFileUploaded: boolean,
            fileName?: string,
            inputText?: string,
            text?: string,
            error?: string,
        }
    } | {
        type: 'PUBLIC_CLEAR_FILE_UPLOAD'
    } | {
        type: 'UPDATE_MENUS', payload: {
            data?: any[],
            error?: string;
        }
    } | {
        type: 'DELETE_CURRENT_CHAT_CONVO'
    }
    | {
        type: 'DELETE_PUBLIC_CURRENT_CHAT_CONVO'
    } 
    | {
        type: 'IS_LOGGED_IN'
    } 

const initialState: AppState = {
    isChatHistoryOpen: false,
    chatHistoryLoadingState: ChatHistoryLoadingState.Loading,
    chatHistory: null,
    filteredChatHistory: null,
    currentChat: null,
    isPostgresDBAvailable: {
        postgresDB: IS_DB_AVAILABLE ? true : false,
        status: IS_DB_AVAILABLE ? PostgresDBStatus.Working : PostgresDBStatus.NotConfigured,
    },
    accessToken: null,
    signup: {
        data: {
            email: ''
        },
        success: null,
        error: {
            message: ''
        },
    },
    trainingStatus: {
        data: {
            content: '',
            status: null
        },
        success: null,
        error: {
            message: ''
        },
    },
    publicChatHistory: null,
    publicCurrentChat: null,
    uploadFile: {
        isFileUploaded: false,
        fileName: '',
        inputText: '',
        text: '',
        error: '',
        identified_tokens:null,
        coloredText:'',
        isTokens:null
    },
    publicUploadFile: {
        isFileUploaded: false,
        fileName: '',
        inputText: '',
        text: '',
        error: '',
    },
    menus: {
        data: [],
        error: ''
    },
    isLoggedIn: false,
};

export const AppStateContext = createContext<{
    state: AppState;
    dispatch: React.Dispatch<Action>;
} | undefined>(undefined);

type AppStateProviderProps = {
    children: ReactNode;
};

export const AppStateProvider: React.FC<AppStateProviderProps> = ({ children }) => {
    const [state, dispatch] = useReducer(appStateReducer, initialState);

    return (
        <AppStateContext.Provider value={{ state, dispatch }}>
            {children}
        </AppStateContext.Provider>
    );
};


