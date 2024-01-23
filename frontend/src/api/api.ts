import { UserInfo, ConversationRequest, Conversation, ChatMessage, PostgresDBHealth, PostgresDBStatus, ChatResponse, FileUpload } from "./models";
import { chatHistorySampleData } from "../constants/chatHistory";
import { IS_DB_AVAILABLE } from "./authConfig";

const apiUrl = import.meta.env.VITE_BACKEND_URL;
export const setupInterceptor = async () => {
    const { fetch: originalFetch } = window;
    window.fetch = async (...args) => {
            let [resource, config] = args;
            const response = await originalFetch(resource, config);
            return response;
    };
};

if (IS_DB_AVAILABLE) {
    setupInterceptor();
}

export async function conversationApi(options: ConversationRequest, abortSignal: AbortSignal): Promise<Response> {
    const response = await fetch(`${apiUrl}/conversation`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            messages: options.messages
        }),
        signal: abortSignal
    });
    return response;
}

export async function getUserInfo(): Promise<UserInfo[]> {
    const response = await fetch(`${apiUrl}/.auth/me`);
    if (!response.ok) {
        console.log("No identity provider found. Access to chat will be blocked.")
        return [];
    }

    const payload = await response.json();
    return payload;
}

export const fetchChatHistoryInit = (): Conversation[] | null => {
    // Make initial API call here

    // return null;
    return chatHistorySampleData;
}

export const historyList = async (): Promise<Conversation[] | null> => {
    const response = await fetch(`${apiUrl}/history/list`, {
        method: "GET",
    }).then(async (res) => {
        const payload = await res.json();
        if (!Array.isArray(payload)) {
            console.error("There was an issue fetching your data.");
            return null;
        }
        const conversations: Conversation[] = await Promise.all(payload.map(async (conv: any) => {
            let convMessages: ChatMessage[] = [];
            convMessages = []
            const conversation: Conversation = {
                id: conv.id,
                title: conv.title,
                date: conv.createdAt,
                messages: convMessages
            };
            return conversation;
        }));
        return conversations;
    }).catch((err) => {
        console.error("There was an issue fetching your data.");
        return null
    })

    return response
}

export const historyRead = async (convId: string): Promise<ChatMessage[]> => {
    const response = await fetch(`${apiUrl}/history/read`, {
        method: "POST",
        body: JSON.stringify({
            conversation_id: convId
        }),
        headers: {
            "Content-Type": "application/json"
        },
    })
        .then(async (res) => {
            if (!res) {
                return []
            }
            const payload = await res.json();
            let messages: ChatMessage[] = [];
            if (payload?.messages) {
                payload.messages.forEach((msg: any) => {
                    const message: ChatMessage = {
                        id: msg.id,
                        role: msg.role,
                        date: msg.createdAt,
                        content: msg.content,
                        identified_pii: msg?.identified_pii
                    }
                    messages.push(message)
                });
            }
            return messages;
        }).catch((err) => {
            console.error("There was an issue fetching your data.");
            return []
        })
    return response
}

export const historyGenerate = async (options: ConversationRequest, abortSignal: AbortSignal, key?: string, isFile?: boolean, convId?: string): Promise<Response> => {
    let body;
    if (convId) {
        body = JSON.stringify({
            conversation_id: convId,
            filter: key,
            isFileUploaded: isFile,
            messages: options.messages
        })
    } else {
        body = JSON.stringify({
            filter: key,
            isFileUploaded: isFile,
            messages: options.messages
        })
    }
    const response = await fetch(`${apiUrl}/history/generate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: body,
        signal: abortSignal
    }).then((res) => {
        return res
    })
        .catch((err) => {
            console.error("There was an issue fetching your data.");
            let errRes: Response = {
                ...new Response,
                ok: false,
                status: 500,
            }
            return errRes;
        })
    return response
}

export const historyUpdate = async (messages: ChatMessage[], convId: string): Promise<Response> => {
    const response = await fetch(`${apiUrl}/history/update`, {
        method: "POST",
        body: JSON.stringify({
            conversation_id: convId,
            messages: messages
        }),
        headers: {
            "Content-Type": "application/json"
        },
    }).then(async (res) => {
        return res
    })
        .catch((err) => {
            console.error("There was an issue fetching your data.");
            let errRes: Response = {
                ...new Response,
                ok: false,
                status: 500,
            }
            return errRes;
        })
    return response
}


export const historyDelete = async (convId: string): Promise<Response> => {
    const response = await fetch(`${apiUrl}/history/delete`, {
        method: "DELETE",
        body: JSON.stringify({
            conversation_id: convId,
        }),
        headers: {
            "Content-Type": "application/json"
        },
    })
        .then((res) => {
            return res
        })
        .catch((err) => {
            console.error("There was an issue fetching your data.");
            let errRes: Response = {
                ...new Response,
                ok: false,
                status: 500,
            }
            return errRes;
        })
    return response;
}

export const historyDeleteAll = async (): Promise<Response> => {
    const response = await fetch(`${apiUrl}/history/delete_all`, {
        method: "DELETE",
        body: JSON.stringify({}),
        headers: {
            "Content-Type": "application/json"
        },
    })
        .then((res) => {
            return res
        })
        .catch((err) => {
            console.error("There was an issue fetching your data.");
            let errRes: Response = {
                ...new Response,
                ok: false,
                status: 500,
            }
            return errRes;
        })
    return response;
}

export const historyClear = async (convId: string): Promise<Response> => {
    const response = await fetch(`${apiUrl}/history/clear`, {
        method: "POST",
        body: JSON.stringify({
            conversation_id: convId,
        }),
        headers: {
            "Content-Type": "application/json"
        },
    })
        .then((res) => {
            return res
        })
        .catch((err) => {
            console.error("There was an issue fetching your data.");
            let errRes: Response = {
                ...new Response,
                ok: false,
                status: 500,
            }
            return errRes;
        })
    return response;
}

export const historyRename = async (convId: string, title: string): Promise<Response> => {
    const response = await fetch(`${apiUrl}/history/rename`, {
        method: "POST",
        body: JSON.stringify({
            conversation_id: convId,
            title: title
        }),
        headers: {
            "Content-Type": "application/json"
        },
    })
        .then((res) => {
            return res
        })
        .catch((err) => {
            console.error("There was an issue fetching your data.");
            let errRes: Response = {
                ...new Response,
                ok: false,
                status: 500,
            }
            return errRes;
        })
    return response;
}

export const historyEnsure = async (): Promise<PostgresDBHealth> => {
    const response = await fetch(`${apiUrl}/history/ensure`, {
        method: "GET",
    })
        .then(async res => {
            let respJson = await res.json();
            let formattedResponse;
            if (respJson.message) {
                formattedResponse = PostgresDBStatus.Working
            } else {
                if (res.status === 500) {
                    formattedResponse = PostgresDBStatus.NotWorking
                } else {
                    formattedResponse = PostgresDBStatus.NotConfigured
                }
            }
            if (!res.ok) {
                return {
                    postgresDB: false,
                    status: formattedResponse
                }
            } else {
                return {
                    postgresDB: true,
                    status: formattedResponse
                }
            }
        })
        .catch((err) => {
            console.error("There was an issue fetching your data.");
            return {
                postgresDB: false,
                status: err
            }
        })
    return response;
}

export async function signup(payload: any): Promise<any> {
    const response = await fetch(`${apiUrl}/signup`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
    }).then(async (res) => {
        const data = await res.json();
        return data
    }).catch((err) => {
        console.error("There was an issue in signup", err);
        let errRes: Response = {
            ...new Response,
            ok: false,
            status: 500,
        }
        return errRes;
    })
    return response;
}

export async function menus(): Promise<any> {
    const response = await fetch(`${apiUrl}/menus`, {
    //const response = await fetch(`http://localhost:3000/menus`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        },
    }).then(async (res) => {
        const data = await res.json();
        return data
    }).catch((err) => {
        console.error("There was an issue retrieving menu data", err);
        let errRes: Response = {
            ...new Response,
            ok: false,
            status: 500,
        }
        return errRes;
    })
    return response;
}

export async function uploadFile(formData: FormData): Promise<any> {
   // const response = await fetch(`${apiUrl}/upload-file`, {
   const response = await fetch(`http://localhost:3000/upload-file`, {
        method: "PUT",
        // headers: {
        //     "Content-Type": "application/json"
        // },
        body: formData,
    }).then(async (res) => {
        const data = await res.json();
        return data
    }).catch((err) => {
        console.error("There was an issue in uploading file api", err);
        let errRes: Response = {
            ...new Response,
            ok: false,
            status: 500,
        }
        return errRes;
    })
    return response;
}

export async function trainingStatus(): Promise<any> {
    const response = await fetch(`${apiUrl}/training`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        },
    }).then(async (res) => {
        const data = await res.json();
        return data
    }).catch((err) => {
        console.error("There was an issue retrieving traning status", err);
        let errRes: Response = {
            ...new Response,
            ok: false,
            status: 500,
        }
        return errRes;
    })
    return response;
}

interface LocalStorageService {
    setItem(key: string, value: string): void;
    getItem(key: string): string | null;
    removeItem(key: string): void;
}

const localStorageService: LocalStorageService = {
    setItem: (key, value) => {
        updateLocalStorage(key, value);
    },
    getItem: (key) => {
        return localStorage.getItem(key);
    },
    removeItem: (key) => {
        localStorage.removeItem(key);
    },
};

export default localStorageService;

const updateLocalStorage = (key: any, value: any) => {
    const existingItem = localStorage.getItem(key);
    if (existingItem !== null) {
        localStorage.removeItem(key);
        localStorage.setItem(key, value);
    } else {
        localStorage.setItem(key, value);
    }
}

