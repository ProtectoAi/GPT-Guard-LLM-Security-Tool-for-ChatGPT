import {
  useRef,
  useState,
  useEffect,
  useContext,
  useLayoutEffect,
  useCallback,
} from "react";
import {
  IconButton,
  Dialog,
  Stack,
  ITooltipHostStyles,
  Spinner,
  SpinnerSize,
  ProgressIndicator,
  FontIcon,
  Panel,
  PanelType,
  Layer,
  Popup,
  Overlay,
  FocusTrapZone,
  DefaultButton,
  TooltipHost
} from "@fluentui/react";
import {
  SquareRegular,
  ErrorCircleRegular,
} from "@fluentui/react-icons";
import { IStyle, mergeStyleSets, mergeStyles } from "@fluentui/react/lib/Styling";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import uuid from "react-uuid";

import styles from "./Chat.module.css";
import eyeOffIcon from "../../assets/eye-off.svg";
import eyeIcon from "../../assets/eye-icon.svg";
import chatIcon from "../../assets/tokenization_chat.svg";
import uploadIcon from "../../assets/file_upload_icon.svg";

import {
  ChatMessage,
  ConversationRequest,
  Citation,
  ToolMessageContent,
  ChatResponse,
  Conversation,
  historyGenerate,
  historyUpdate,
  ChatHistoryLoadingState,
  PostgresDBStatus,
  trainingStatus,
  FileUpload,
  MaskPosition,
} from "../../api";
import { Answer } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { AppStateContext } from "../../state/AppProvider";
import { IS_DB_AVAILABLE } from "../../api/authConfig";
import { historyEnsure } from "../../api/api";
import { pdfjs } from 'react-pdf'
import { useBoolean } from "@fluentui/react-hooks";
import React from "react";
import axios from "axios";
import { useId } from '@fluentui/react-hooks';
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const enum messageStatus {
  NotRunning = "Not Running",
  Processing = "Processing",
  Done = "Done",
}

const Chat = () => {
  
  const appStateContext = useContext(AppStateContext);
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showLoadingMessage, setShowLoadingMessage] = useState<boolean>(false);
  const [activeCitation, setActiveCitation] =
    useState<
      [
        content: string,
        id: string,
        title: string,
        filepath: string,
        url: string,
        metadata: string
      ]
    >();
  const [isCitationPanelOpen, setIsCitationPanelOpen] =
    useState<boolean>(false);
  const abortFuncs = useRef([] as AbortController[]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [processMessages, setProcessMessages] = useState<messageStatus>(
    messageStatus.NotRunning
  );
  const [hideErrorDialog, toggleErrorDialog] = useState<boolean>(true);
  const [isSharePanelOpen, setIsSharePanelOpen] = useState<boolean>(false);
  const [isLoader, setIsLoader] = useState<boolean>(false);
  let [trainingProgressInterval, setTrainingProgressInterval] =
    useState<number>(0);
  const [progress, setProgress] = useState(0);
  const [errorContent, setErrorContent] = useState<string>("There was an error generating a response. Chat history can't be saved at this time. If the problem persists, please contact the site administrator.");
  const [isPopupVisible, { setTrue: showPopup, setFalse: hidePopup }] = useBoolean(false);
  const calloutProps = { gapSpace: 0 };
  const tooltipId = useId('tooltip');
  const trainingStatusText = appStateContext?.state?.trainingStatus;

  const [isFileInvalid, setIsFileInvalid] = useState<{
    isInValid: boolean,
    errorMessage?: string,
    isMultipage?: boolean
  }>({
    isInValid: false,
    errorMessage: ''
  });
  const [isFileUploaded, setIsFileUploaded] = useState<{
    isFileUploaded: boolean,
    fileName?: string
  }>({
    isFileUploaded: false,
    fileName: ''
  });
  const [isAPIError, setAPIError] = useState<{
    isError: boolean,
    errorMessage?: string
  }>({
    isError: false,
    errorMessage: ''
  });
  const [isFileViewClicked, setIsFileViewClicked] = useState(false);
  const [isAPIFailed, { setTrue: showAPIError, setFalse: hidePopupAPIError }] = useBoolean(false);

  const maxFileSizeInKb = import.meta.env.VITE_MAX_FILE_SIZE_IN_KB;
  const maxFileSize = maxFileSizeInKb * 1024

  const fileIconClass = mergeStyles({
    marginTop: 2,
    marginBottom: 7
  });

  const hostStyles: Partial<ITooltipHostStyles> = {
    root: { display: "block", padding: "10px 5px 10px" },
  };

  const popupStyles = mergeStyleSets({
    root: {
      background: 'rgba(0, 0, 0, 0.2)',
      bottom: '0',
      left: '0',
      position: 'fixed',
      right: '0',
      top: '0',
    },
    content: {
      background: 'white',
      left: '50%',
      maxWidth: '400px',
      padding: '0 2em 2em',
      position: 'absolute',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    },
  });

  const navStyles: IStyle = {
    root: {
      position: 'absolute',
      selectors: {
        '.ms-Panel-header': {
          flexGrow: 0,
        },
        '.ms-Panel-navigation': {
          justifyContent: 'flex-start !important',
        }

      },
    }
  }

  useEffect(() => {
    if (appStateContext?.state.isPostgresDBAvailable?.status === PostgresDBStatus.NotWorking && appStateContext.state.chatHistoryLoadingState === ChatHistoryLoadingState.Fail && hideErrorDialog) {
      toggleErrorDialog(false);
    }
    if (appStateContext?.state.isPostgresDBAvailable?.status === PostgresDBStatus.Working && appStateContext.state.chatHistoryLoadingState === ChatHistoryLoadingState.Success) {
      toggleErrorDialog(true);
    }
  }, [appStateContext?.state.isPostgresDBAvailable]);

  useEffect(() => {
    checkTrainingStatus();
  }, [
    appStateContext?.state?.trainingStatus?.success,
    appStateContext?.state?.trainingStatus?.data?.status,
  ]);

  useEffect(() => {
    if (
      appStateContext?.state.isPostgresDBAvailable?.status ===
      PostgresDBStatus.NotWorking &&
      appStateContext.state.chatHistoryLoadingState ===
      ChatHistoryLoadingState.Fail &&
      hideErrorDialog
    ) {
      toggleErrorDialog(false);
    }
    if (
      appStateContext?.state.isPostgresDBAvailable?.status ===
      PostgresDBStatus.Working &&
      appStateContext.state.chatHistoryLoadingState ===
      ChatHistoryLoadingState.Success
    ) {
      toggleErrorDialog(true);
    }
  }, [appStateContext?.state.isPostgresDBAvailable]);

  useEffect(() => {
    if (appStateContext?.state.currentChat) {
      setMessages(appStateContext.state.currentChat.messages);
    } else {
      setMessages([]);
    }
  }, [appStateContext?.state.currentChat]);

  useEffect(() => {
    setMessages(removeDuplicateMessages(messages))
  }, [messages?.length])

  useEffect(() => {
    handleAddFileDataInMessages();
  }, [appStateContext?.state?.uploadFile])

  useEffect(() => {
    if (isFileInvalid) {
      showPopup()
    }
  }, [isFileInvalid])

  useEffect(() => {
    if (!appStateContext?.state?.uploadFile?.isFileUploaded && appStateContext?.state?.uploadFile?.error?.length !== 0) {
      showAPIError()
      setAPIError({
        isError: true,
        errorMessage: appStateContext?.state?.uploadFile?.error
      })
    }
  }, [appStateContext?.state?.uploadFile])

  useEffect(() => {
    if (appStateContext?.state.currentChat) {
      setMessages(appStateContext.state.currentChat.messages);
    }
  }, [])

  useEffect(() => {
    if (!appStateContext?.state?.currentChat?.id) {
      getHistoryEnsure();
    }
  }, [])

  useEffect(() => {
    if (appStateContext?.state?.uploadFile?.isFileUploaded && appStateContext?.state?.uploadFile?.identified_tokens && appStateContext?.state?.uploadFile?.identified_tokens?.length > 0 && appStateContext?.state?.uploadFile?.text && appStateContext?.state?.uploadFile?.text?.length > 0) {
      let coloredToken: any = colorToken(appStateContext?.state?.uploadFile?.text, appStateContext?.state?.uploadFile.identified_tokens);
      appStateContext?.dispatch({
        type: "UPDATE_FILE_UPLOAD",
        payload: {
          ...appStateContext?.state?.uploadFile,
          coloredText: coloredToken !== null && coloredToken !== undefined && coloredToken?.length > 0 ? coloredToken : '',
          isTokens: true,
        },
      });
    }
  }, [appStateContext?.state?.uploadFile?.identified_tokens])

  useEffect(() => {
    let error = messages?.filter((message) => message.role === "error")?.length
    if (error > 0 && error === 2) {
      if (messages[messages.length - 3] &&
        messages[messages.length - 3].role === "user" &&
        messages[messages.length - 2] &&
        messages[messages.length - 2].role === "error" &&
        messages[messages.length - 1] &&
        messages[messages.length - 1].role === "error") {

        let oneError = messages.splice(messages.length - 2, 1)
        let array = messages?.filter((message) => message.role !== "error");
        let combinedArray = [...array, ...oneError];
        setMessages(combinedArray)
      }
    }
  }, [messages])

  useLayoutEffect(() => {
    if(IS_DB_AVAILABLE){
    const saveToDB = async (messages: ChatMessage[], id: string) => {
      let messageList;
      let list = filterError(messages)
      messageList = removeDuplicateMessages(list);
      const response = await historyUpdate(messageList, id);
      return response;
    };
    if (
      appStateContext &&
      appStateContext.state.currentChat &&
      processMessages === messageStatus.Done
    ) {
      if (appStateContext.state.isPostgresDBAvailable.postgresDB) {
        if (!appStateContext?.state.currentChat?.messages) {
          console.error("Failure fetching current chat state.");
          return;
        }
        saveToDB(
          appStateContext.state.currentChat.messages,
          appStateContext.state.currentChat.id
        )
          .then((res) => {
            if (!res.ok) {
              let errorMessage = errorContent;
              let errorChatMsg: ChatMessage = {
                id: uuid(),
                role: "error",
                content: errorMessage,
                date: new Date().toISOString(),
              };
              if (!appStateContext?.state.currentChat?.messages) {
                let err: Error = {
                  ...new Error(),
                  message: "Failure fetching current chat state.",
                };
                throw err;
              }
              setMessages([
                ...appStateContext?.state.currentChat?.messages,
                errorChatMsg,
              ]);
            }
            return res as Response;
          })
          .catch((err) => {
            console.error("Error: ", err);
            let errRes: Response = {
              ...new Response(),
              ok: false,
              status: 500,
            };
            return errRes;
          });
      } else {
      }
      appStateContext?.dispatch({
        type: "UPDATE_CHAT_HISTORY",
        payload: appStateContext.state.currentChat,
      });
      setMessages(appStateContext.state.currentChat.messages);
      setProcessMessages(messageStatus.NotRunning);
    }
  }
  else {
    const saveToDB = async (messages: ChatMessage[], id: string) => {
      let messageList;
      let list = filterError(messages)
      messageList = removeDuplicateMessages(list);
    };
    if (
      appStateContext &&
      appStateContext.state.currentChat &&
      processMessages === messageStatus.Done
    ) {
      if (appStateContext.state.isPostgresDBAvailable.postgresDB) {
        saveToDB(
          appStateContext.state.currentChat.messages,
          appStateContext.state.currentChat.id
        )
      } 
      appStateContext?.dispatch({
        type: "UPDATE_CHAT_HISTORY",
        payload: appStateContext.state.currentChat,
      });
      setMessages(appStateContext.state.currentChat.messages);
      setProcessMessages(messageStatus.NotRunning);
    }
  }
  }, [processMessages]);

  useLayoutEffect(() => {
    chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [showLoadingMessage, processMessages]);


  const isData = (data: string | any[] | null | undefined) => {
    if (data && data !== undefined && data !== null && data?.length !== 0) {
      return true
    }
    return false
  }

  const handleFileChange = (event: any) => {
    onFileChange(event);
  };

  const stopGenerating = () => {
    abortFuncs.current.forEach((a) => a.abort());
    setShowLoadingMessage(false);
    setIsLoading(false);
  };

  const newChat = () => {
    setIsFileUploaded({
      isFileUploaded: false,
      fileName: ''
    })
    handleFileRemove()
    setProcessMessages(messageStatus.NotRunning);
    setMessages([]);
    setIsCitationPanelOpen(false);
    setActiveCitation(undefined);
    appStateContext?.dispatch({ type: "UPDATE_CURRENT_CHAT", payload: null });
  };

  const sendUploadedFile = async (data: FileUpload): Promise<{
    fileName?: string
  } | null> => {
    const formData = new FormData();
    formData.append('pdfFile', data?.file);
    formData.append('filter', 'private');
    const result = await uploadFile(formData)
      .then((response) => {
        if (response?.success) {
          if (response?.fileInvalid?.message && response?.fileInvalid?.message?.length !== 0) {
            if (isPopupVisible) {
              hidePopup()
            }
            appStateContext?.dispatch({
              type: "UPDATE_FILE_UPLOAD",
              payload: {
                ...appStateContext?.state?.uploadFile,
                isFileUploaded: false,
                error: response?.fileInvalid?.message
              },
            });
          }
          else {
            appStateContext?.dispatch({
              type: "UPDATE_FILE_UPLOAD",
              payload: {
                isFileUploaded: true,
                text: response?.data?.text,
                fileName: data?.fileName,
                identified_tokens: response?.data?.identified_tokens
              },
            });
          }
          setIsFileUploaded({
            isFileUploaded: false,
          })
        } else {
          if (isPopupVisible) {
            hidePopup()
          }
          setIsFileUploaded({
            isFileUploaded: false,
          })
          if (response?.error?.message)
            appStateContext?.dispatch({
              type: "UPDATE_FILE_UPLOAD",
              payload: {
                isFileUploaded: false,
                error: response?.error?.message
              },
            });
          if (!response?.error?.message) {
            appStateContext?.dispatch({
              type: "UPDATE_FILE_UPLOAD",
              payload: {
                isFileUploaded: false,
                error: "There was an issue in uploading file. Please try again"
              },
            });
          }
        }
        return response;
      })
      .catch((err) => {
        setIsFileUploaded({
          isFileUploaded: false,
        })
        appStateContext?.dispatch({
          type: "UPDATE_FILE_UPLOAD",
          payload: {
            isFileUploaded: false,
            error: err
          },
        });
        console.error("There was an issue in uploading file. Please try again");
        return null;
      });
    return result;
  };

  const trainingProgress = () => {
    trainingProgressInterval = setInterval(() => {
      fetchTrainingData();
    }, 300000);
  };

  const clearTrainingProgressInterval = () => {
    clearInterval(trainingProgressInterval);
  };

  async function getTrainingStatus() {
    try {
      const response = await trainingStatus();
      if (response && response.success) {
        appStateContext?.dispatch({ type: 'TRAINING_STATUS', payload: response });
      } else if (response && !response.success) {
        appStateContext?.dispatch({ type: 'TRAINING_STATUS', payload: response });
        console.error(response?.error?.message);
        throw new Error(response?.error?.message);
      }
    } catch (error) {
      console.error('An error occurred during training status fetch:', error);
      throw error;
    }
  }

  const fetchTrainingData = async () => {
    try {
      getTrainingStatus();
    } catch (error) {
      console.error("An error occurred:", error);
    }
  };

  const fetchChatHistory = async () => {
    appStateContext?.dispatch({
      type: "FETCH_CHAT_HISTORY",
      payload: [],
    });
    return [];
  };

  const getHistoryEnsure = async () => {
    setIsLoader(false)
    appStateContext?.dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Loading });
    historyEnsure().then((response) => {
      fetchTrainingData()
      if (response?.postgresDB) {
        fetchChatHistory()
          .then((res) => {
            if (res) {
              appStateContext?.dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Success });
              appStateContext?.dispatch({ type: 'SET_POSTGRESDB_STATUS', payload: response });
            } else {
              appStateContext?.dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail });
              appStateContext?.dispatch({ type: 'SET_POSTGRESDB_STATUS', payload: { postgresDB: false, status: PostgresDBStatus.NotWorking } });
            }
            setIsLoader(false)
          })
          .catch((err) => {
            appStateContext?.dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail });
            appStateContext?.dispatch({ type: 'SET_POSTGRESDB_STATUS', payload: { postgresDB: false, status: PostgresDBStatus.NotWorking } });
            setIsLoader(false)
          })
      } else {
        appStateContext?.dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail });
        appStateContext?.dispatch({ type: 'SET_POSTGRESDB_STATUS', payload: response });
        setIsLoader(false)
      }
    })
      .catch((err) => {
        fetchTrainingData()
        appStateContext?.dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail });
        appStateContext?.dispatch({ type: 'SET_POSTGRESDB_STATUS', payload: { postgresDB: false, status: PostgresDBStatus.NotConfigured } });
        setIsLoader(false)
      })
  }

  function checkTrainingStatus() {
    let status = appStateContext?.state?.trainingStatus;
    if (
      status &&
      status.success !== null &&
      status.success &&
      !status?.data?.status
    ) {
      setIsSharePanelOpen(true);
      trainingProgress();
    } else if (
      status &&
      status.success !== null &&
      !status.success &&
      status?.error?.message &&
      status?.error?.message !== null &&
      status?.error?.message?.length !== 0) {
      if (status?.error?.message === "Access token has expired or is not yet valid.") {
        setIsSharePanelOpen(false);
      }
      else {
        setIsSharePanelOpen(true);
      }
    } else if (
      status &&
      status.success !== null &&
      status.success &&
      status?.data?.status
    ) {
      setIsSharePanelOpen(false);
      clearTrainingProgressInterval();
    }
  }

  const onShowCitation = (citation: Citation) => {
    setActiveCitation([
      citation.content,
      citation.id,
      citation.title ?? "",
      citation.filepath ?? "",
      "",
      "",
    ]);
    setIsCitationPanelOpen(true);
  };

  const parseCitationFromMessage = (message: ChatMessage) => {
    if (message?.role && message?.role === "tool") {
      try {
        const toolMessage = JSON.parse(message.content) as ToolMessageContent;
        return toolMessage.citations;
      } catch {
        return [];
      }
    }
    return [];
  };

  const findErrorInMessages = (messages: ChatMessage[]) => {
    if (messages && messages?.length > 1) {
      if (
        messages[messages.length - 2] &&
        messages[messages.length - 2].role === "user" &&
        messages[messages.length - 1] &&
        messages[messages.length - 1].role === "error"
      ) {
        makeApiRequestWithPostgresDBRegenerate(
          messages[messages.length - 2]?.content,
          messages[messages.length - 2]?.id
        );
        return true;
      } else if (
        messages[messages.length - 3] &&
        messages[messages.length - 3].role === "user" &&
        messages[messages.length - 2] &&
        messages[messages.length - 2].role === "error" &&
        messages[messages.length - 1] &&
        messages[messages.length - 1].role === "error"
      ) {
        makeApiRequestWithPostgresDBRegenerate(
          messages[messages.length - 3]?.content,
          messages[messages.length - 3]?.id
        );
        return true;
      }
    }
    return false;
  };
  const regenerate = () => {
    let isErrorOccured = findErrorInMessages(messages);
    if (isErrorOccured) {
      setMessages(filterError(messages));
    }
  };

  const filterError = (messages: ChatMessage[]) => {
    let data = [...messages.filter((answer) => answer.role !== "error")];
    return data;
  };

  const removeDuplicateMessages = (messages: ChatMessage[]): ChatMessage[] => {
    const uniqueMessages: { [key: string]: ChatMessage } = {};

    for (const message of messages) {
      if (
        !uniqueMessages[message.id] ||
        uniqueMessages[message.id].date < message.date
      ) {
        uniqueMessages[message.id] = message;
      }
    }
    return Object.values(uniqueMessages);
  };

  const handleFileRemove = () => {
    appStateContext?.dispatch({ type: "CLEAR_FILE_UPLOAD" });
  }

  const handleFileView = () => {
    setIsFileViewClicked(true)
  }

  const handleFileViewClose = () => {
    setIsFileViewClicked(false)
  }

  const handleDrop = (event: any) => {
    event.preventDefault();

    const droppedFiles = event.dataTransfer.files;

    if (droppedFiles.length > 0) {
      const droppedFile = droppedFiles[0];

      if (droppedFile.type === 'application/pdf') {
        if (appStateContext?.state?.uploadFile?.isFileUploaded) {
          setIsFileInvalid({
            isInValid: true,
            errorMessage: 'File already exists. If you want to drag and drop a new pdf, please clear the chat and start a new conversation'
          });
        }
        else {
          onFileChange(event, droppedFile)
        }
      } else {
        setIsFileInvalid({
          isInValid: true,
          errorMessage: 'Please drop only a PDF file. Check the file you have uploaded and try again.'
        });
      }
    }
  };

  const handleDragOver = (event: any) => {
    event.preventDefault();
  };

  const colorToken = (text1: string, mask_position: MaskPosition[]) => {
    if (!text1 || !mask_position) {
      console.error('Input data is undefined or null');
      return null;
    }

    const elements = mask_position?.map(({ key }) => {
      const indexOfKey = text1.indexOf(key);

      if (indexOfKey === -1) {
        console.error(`Key "${key}" not found in text`);
        return null;
      }
      const beforeElement = React.createElement('span', null, text1.substring(0, indexOfKey));
      const keyElement = React.createElement('span', { style: { color: 'green' } }, key);
      text1 = text1.substring(indexOfKey + key.length);

      return [beforeElement, keyElement];
    });

    elements?.push(React.createElement('span', null, text1) as any);
    return elements;
  };

  async function uploadFile(formData: FormData): Promise<any> {
    const apiUrl = import.meta.env.VITE_BACKEND_URL;
    const response = await axios.put(`${apiUrl}/upload-file`, formData, {
      onUploadProgress: (progressEvent: any) => {
        setProgress(30);
        let percentage: any = (progressEvent.loaded / progressEvent.total) * 100;
        percentage = Math.round(percentage);
        setProgress(percentage);
      },
    }).then(async (res) => {
      const data = await res;
      return data.data
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

  const trimSpaces = (question : string) : string => {
    if(question && question!== null && question !== undefined && question?.length > 0){
      const trimmedStart = question.replace(/^\s+/, '');
      const trimmedEnd = trimmedStart.replace(/\s+$/, '');
      const combinedText = trimmedEnd;
      return combinedText
    }
    return ''
  }

  const onRenderFooterContent = useCallback(
    () => (
      <div className={styles.footerCloseBtn}>
        <DefaultButton onClick={handleFileViewClose}>Close</DefaultButton>
      </div>
    ),
    [handleFileViewClose],
  );

//generate
  const makeApiRequestWithPostgresDB = async (
    question: string,
    conversationId?: string
  ) => {
    let userMessage: ChatMessage = {
      id: uuid(),
      role: "user",
      content: question,
      displayContent: question,
      date: new Date().toISOString(),
      isOpen: false
    };
    if (conversationId === undefined) {
      await setInitialConversation()
        .then(async (response) => {
          if (response) {
            userMessage.conversationId = response?.convId;
            conversationId = response?.convId;
            await callApiRequestInitialDB(userMessage, response?.convId, response?.resultConversation)
          }
        })
        .catch((err) => {
          console.error("There was an issue fetching your data.");
          return null;
        });
    } else {
      await callApiRequestWithDB(userMessage, conversationId);
    }
  };

  const setInitialConversation = async () => {
    let convId = uuid();
    let resultConversation: {
      id: string,
      title: string,
      messages: ChatMessage[],
      date: string
    };
    resultConversation = {
      id: convId,
      title: "New Conversation",
      messages: [],
      date: new Date().toISOString(),
    };
    appStateContext?.dispatch({
      type: "UPDATE_CURRENT_CHAT",
      payload: resultConversation,
    });
    appStateContext?.dispatch({
      type: "UPDATE_CHAT_HISTORY",
      payload: resultConversation,
    });
    return { convId, resultConversation };
  };

  const callApiRequestInitialDB = async (
    userMessage: ChatMessage,
    conversationId?: string,
    conversationValue?: Conversation
  ) => {
    setIsLoading(true);
    setShowLoadingMessage(true);
    const abortController = new AbortController();
    abortFuncs.current.unshift(abortController);
    let request: ConversationRequest;
    let conversation = conversationValue;
    if (conversationId && conversation?.id) {
      {
        conversation.messages.push(userMessage);
        request = {
          messages: [
            ...conversation.messages.filter(
              (answer) => answer.role !== "error"
            ),
          ],
        };
      }
    } else {
      request = {
        messages: [userMessage].filter((answer) => answer.role !== "error"),
      };
      setMessages(request.messages);
    }
    let result = {} as ChatResponse;
    try {
      const response = conversationId
        ? await historyGenerate(request, abortController.signal, "private", appStateContext?.state?.uploadFile?.isFileUploaded, conversationId)
        : await historyGenerate(request, abortController.signal, "private", appStateContext?.state?.uploadFile?.isFileUploaded);
      if (!response?.ok) {
        let errorChatMsg: ChatMessage = {
          id: uuid(),
          role: "error",
          content:
            "There was an error generating a response. Chat history can't be saved at this time. If the problem persists, please contact the site administrator.",
          date: new Date().toISOString(),
        };
        let resultConversation;
        resultConversation = conversationValue
        if (conversationId) {
          if (resultConversation) {
            resultConversation?.messages?.push(errorChatMsg);
          }
        } else {
          setMessages([...messages, userMessage, errorChatMsg]);
          setIsLoading(false);
          setShowLoadingMessage(false);
          abortFuncs.current = abortFuncs.current.filter(
            (a) => a !== abortController
          );
          return;
        }
        if (resultConversation) {
          appStateContext?.dispatch({
            type: "UPDATE_CURRENT_CHAT",
            payload: resultConversation,
          });
          setMessages([...resultConversation.messages]);
        }
        return;
      }
      if (response?.body) {
        const reader = response.body.getReader();
        let runningText = "";

        while (true) {
          setProcessMessages(messageStatus.Processing);
          const { done, value } = await reader.read();
          if (done) break;

          var text = new TextDecoder("utf-8").decode(value);
          const objects = text.split("\n");
          objects.forEach((obj) => {
            try {
              runningText += obj;
              result = JSON.parse(runningText);
              result.choices[0].messages.forEach((obj) => {
                obj.id = uuid();
                obj.date = new Date().toISOString();
                if (obj.identified_pii && obj.identified_pii?.length > 0) {
                  userMessage.masked_content_user = obj.masked_content_user
                  if (obj?.identified_tokens && obj.identified_tokens?.length !== 0) {
                    userMessage.identified_tokens = obj.identified_tokens
                  }
                }
              });
              setShowLoadingMessage(false);
              if (!conversationId) {
                setMessages([
                  ...messages,
                  userMessage,
                  ...result.choices[0].messages,
                ]);
              } else {
                setMessages([...messages, ...result.choices[0].messages]);
              }
              runningText = "";
            } catch { }
          });
        }

        let resultConversation;
        if (conversationId) {
          resultConversation = {
            id: result.history_metadata.conversation_id,
            title: result.history_metadata.title,
            messages: [userMessage],
            date: result.history_metadata.date,
          };
          resultConversation.messages.push(...result.choices[0].messages);
        } 
        if (!resultConversation) {
          setIsLoading(false);
          setShowLoadingMessage(false);
          abortFuncs.current = abortFuncs.current.filter(
            (a) => a !== abortController
          );
          return;
        }
        appStateContext?.dispatch({
          type: "UPDATE_CURRENT_CHAT",
          payload: resultConversation,
        });
        setMessages([...messages, ...result.choices[0].messages]);
      }
    } catch (e) {
      if (!abortController.signal.aborted) {
        let errorMessage = errorContent;
        if (result.error?.message) {
          errorMessage = errorContent;
        } else if (typeof result.error === "string") {
          errorMessage = errorContent;
        }
        let errorChatMsg: ChatMessage = {
          id: uuid(),
          role: "error",
          content: errorMessage,
          date: new Date().toISOString(),
        };
        let resultConversation;
        if (conversationId) {
          resultConversation = conversationValue;
          if (!resultConversation) {
            console.error("Conversation not found.");
            setIsLoading(false);
            setShowLoadingMessage(false);
            abortFuncs.current = abortFuncs.current.filter(
              (a) => a !== abortController
            );
            return;
          }
          resultConversation.messages.push(errorChatMsg);
        } else {
          if (!result.history_metadata) {
            console.error("Error retrieving data.", result);
            setIsLoading(false);
            setShowLoadingMessage(false);
            abortFuncs.current = abortFuncs.current.filter(
              (a) => a !== abortController
            );
            return;
          }
          resultConversation = {
            id: result.history_metadata.conversation_id,
            title: result.history_metadata.title,
            messages: [userMessage],
            date: result.history_metadata.date,
          };
          resultConversation.messages.push(errorChatMsg);
        }
        if (!resultConversation) {
          setIsLoading(false);
          setShowLoadingMessage(false);
          abortFuncs.current = abortFuncs.current.filter(
            (a) => a !== abortController
          );
          return;
        }
        appStateContext?.dispatch({
          type: "UPDATE_CURRENT_CHAT",
          payload: resultConversation,
        });
        setMessages([...messages, errorChatMsg]);
      } else {
        setMessages([...messages, userMessage]);
      }
    } finally {
      setIsLoading(false);
      setShowLoadingMessage(false);
      abortFuncs.current = abortFuncs.current.filter(
        (a) => a !== abortController
      );
      setProcessMessages(messageStatus.Done);
      setMessages([...messages, userMessage]);
    }
    return abortController.abort();
  };

  const callApiRequestWithDB = async (
    userMessage: ChatMessage,
    conversationId?: string,
  ) => {
    setMessages([...messages, userMessage]);
    setIsLoading(true);
    setShowLoadingMessage(true);
    const abortController = new AbortController();
    abortFuncs.current.unshift(abortController);
    let request: ConversationRequest;
    let conversation;
    if (conversationId) {
      conversation = appStateContext?.state?.chatHistory?.find(
        (conv) => conv.id === conversationId
      );
      if (!conversation) {
        console.error("Conversation not found.");
        setIsLoading(false);
        setShowLoadingMessage(false);
        abortFuncs.current = abortFuncs.current.filter(
          (a) => a !== abortController
        );
        return;
      } else {
        conversation.messages.push(userMessage);
        request = {
          messages: [
            ...conversation.messages.filter(
              (answer) => answer.role !== "error"
            ),
          ],
        };
      }
    } else {
      request = {
        messages: [userMessage].filter((answer) => answer.role !== "error"),
      };
      setMessages(request.messages);
    }

    let result = {} as ChatResponse;
    try {
      const response = conversationId
        ? await historyGenerate(request, abortController.signal, "private", appStateContext?.state?.uploadFile?.isFileUploaded, conversationId)
        : await historyGenerate(request, abortController.signal, "private", appStateContext?.state?.uploadFile?.isFileUploaded);
      if (!response?.ok) {
        let errorChatMsg: ChatMessage = {
          id: uuid(),
          role: "error",
          content:
            "There was an error generating a response. Chat history can't be saved at this time. If the problem persists, please contact the site administrator.",
          date: new Date().toISOString(),
        };
        let resultConversation;
        if (conversationId) {
          resultConversation = appStateContext?.state?.chatHistory?.find(
            (conv) => conv.id === conversationId
          );
          if (!resultConversation) {
            console.error("Conversation not found.");
            setIsLoading(false);
            setShowLoadingMessage(false);
            abortFuncs.current = abortFuncs.current.filter(
              (a) => a !== abortController
            );
            return;
          }
          resultConversation.messages.push(errorChatMsg);
        } else {
          setMessages([...messages, userMessage, errorChatMsg]);
          setIsLoading(false);
          setShowLoadingMessage(false);
          abortFuncs.current = abortFuncs.current.filter(
            (a) => a !== abortController
          );
          return;
        }
        appStateContext?.dispatch({
          type: "UPDATE_CURRENT_CHAT",
          payload: resultConversation,
        });
        setMessages([...resultConversation.messages]);
        return;
      }
      if (response?.body) {
        const reader = response.body.getReader();
        let runningText = "";

        while (true) {
          setProcessMessages(messageStatus.Processing);
          const { done, value } = await reader.read();
          if (done) break;

          var text = new TextDecoder("utf-8").decode(value);
          const objects = text.split("\n");
          objects.forEach((obj) => {
            try {
              runningText += obj;
              result = JSON.parse(runningText);
              result.choices[0].messages.forEach((obj) => {
                obj.id = uuid();
                obj.date = new Date().toISOString();
                if (obj.identified_pii && obj.identified_pii?.length > 0) {
                  userMessage.masked_content_user = obj.masked_content_user
                  if (obj?.identified_tokens && obj.identified_tokens?.length !== 0) {
                    userMessage.identified_tokens = obj.identified_tokens
                  }
                }
              });
              setShowLoadingMessage(false);
              if (!conversationId) {
                setMessages([
                  ...messages,
                  userMessage,
                  ...result.choices[0].messages,
                ]);
              } else {
                setMessages([...messages, ...result.choices[0].messages]);
              }
              runningText = "";
            } catch { }
          });
        }

        let resultConversation;
        if (conversationId) {
          resultConversation = appStateContext?.state?.chatHistory?.find(
            (conv) => conv.id === conversationId
          );
          if (!resultConversation) {
            console.error("Conversation not found.");
            setIsLoading(false);
            setShowLoadingMessage(false);
            abortFuncs.current = abortFuncs.current.filter(
              (a) => a !== abortController
            );
            return;
          }
          resultConversation.messages.push(...result.choices[0].messages);
        } else {
          resultConversation = {
            id: result.history_metadata.conversation_id,
            title: result.history_metadata.title,
            messages: [userMessage],
            date: result.history_metadata.date,
          };
          resultConversation.messages.push(...result.choices[0].messages);
        }
        if (!resultConversation) {
          setIsLoading(false);
          setShowLoadingMessage(false);
          abortFuncs.current = abortFuncs.current.filter(
            (a) => a !== abortController
          );
          return;
        }
        appStateContext?.dispatch({
          type: "UPDATE_CURRENT_CHAT",
          payload: resultConversation,
        });
        setMessages([...messages, ...result.choices[0].messages]);
      }
    } catch (e) {
      if (!abortController.signal.aborted) {
        let errorMessage = errorContent;
        if (result.error?.message) {
          errorMessage = errorContent;
        } else if (typeof result.error === "string") {
          errorMessage = errorContent
        }
        let errorChatMsg: ChatMessage = {
          id: uuid(),
          role: "error",
          content: errorMessage,
          date: new Date().toISOString(),
        };
        let resultConversation;
        if (conversationId) {
          resultConversation = appStateContext?.state?.chatHistory?.find(
            (conv) => conv.id === conversationId
          );
          if (!resultConversation) {
            console.error("Conversation not found.");
            setIsLoading(false);
            setShowLoadingMessage(false);
            abortFuncs.current = abortFuncs.current.filter(
              (a) => a !== abortController
            );
            return;
          }
          resultConversation.messages.push(errorChatMsg);
        } else {
          if (!result.history_metadata) {
            console.error("Error retrieving data.", result);
            setIsLoading(false);
            setShowLoadingMessage(false);
            abortFuncs.current = abortFuncs.current.filter(
              (a) => a !== abortController
            );
            return;
          }
          resultConversation = {
            id: result.history_metadata.conversation_id,
            title: result.history_metadata.title,
            messages: [userMessage],
            date: result.history_metadata.date,
          };
          resultConversation.messages.push(errorChatMsg);
        }
        if (!resultConversation) {
          setIsLoading(false);
          setShowLoadingMessage(false);
          abortFuncs.current = abortFuncs.current.filter(
            (a) => a !== abortController
          );
          return;
        }
        appStateContext?.dispatch({
          type: "UPDATE_CURRENT_CHAT",
          payload: resultConversation,
        });
        setMessages([...messages, errorChatMsg]);
      } else {
        setMessages([...messages, userMessage]);
      }
    } finally {
      setIsLoading(false);
      setShowLoadingMessage(false);
      abortFuncs.current = abortFuncs.current.filter(
        (a) => a !== abortController
      );
      setProcessMessages(messageStatus.Done);
      setMessages([...messages, userMessage]);
    }
    return abortController.abort();
  };

  //regenerate
  const makeApiRequestWithPostgresDBRegenerate = async (
    question: string,
    questionId?: string
  ) => {
    let resultConversation;
    if (appStateContext?.state?.currentChat?.id) {
      resultConversation = appStateContext?.state?.chatHistory?.find(
        (conv) => conv.id === appStateContext?.state?.currentChat?.id
      );
      if (
        resultConversation?.messages &&
        resultConversation?.messages?.length > 0
      ) {
        resultConversation.messages = resultConversation.messages.filter(
          (answer) => answer.role !== "error"
        );
        const updatedResultConversation = {
          ...resultConversation,
          messages: removeDuplicateMessages(resultConversation?.messages),
        };
        appStateContext?.dispatch({
          type: "UPDATE_CURRENT_CHAT",
          payload: updatedResultConversation,
        });
        appStateContext?.dispatch({
          type: "UPDATE_CHAT_HISTORY",
          payload: updatedResultConversation,
        });
        setMessages([...updatedResultConversation.messages]);
      }
    }

    setProcessMessages(messageStatus.NotRunning);
    setIsLoading(true);
    setShowLoadingMessage(true);
    const abortController = new AbortController();
    abortFuncs.current.unshift(abortController);
    const userMessage: ChatMessage = {
      id: questionId !== null &&
        questionId?.length !== 0 &&
        questionId !== undefined
        ? (questionId as any)
        : uuid(),
      role: "user",
      content: question,
      displayContent:question,
      date: new Date().toISOString(),
      isOpen: false
    };

    let request: ConversationRequest;
    let conversation;
    let conversationId: string | undefined = undefined;
    conversationId = appStateContext?.state?.currentChat?.id
      ? appStateContext?.state?.currentChat?.id
      : undefined;
    if (conversationId) {
      conversation = appStateContext?.state?.chatHistory?.find(
        (conv) => conv.id === conversationId
      );
      if (!conversation) {
        console.error("Conversation not found.");
        setIsLoading(false);
        setShowLoadingMessage(false);
        abortFuncs.current = abortFuncs.current.filter(
          (a) => a !== abortController
        );
        return;
      } else {
        conversation.messages.push(userMessage);
        let list = [
          ...conversation.messages.filter((answer) => answer.role !== "error"),
        ];
        let messageList = removeDuplicateMessages(list);
        request = {
          messages: [...messageList],
        };
      }
    } else {
      let list = [userMessage].filter((answer) => answer.role !== "error");
      let messageList = removeDuplicateMessages(list);
      request = {
        messages: [...messageList],
      };
      setMessages(request.messages);
    }

    let result = {} as ChatResponse;
    try {
      const response = conversationId
        ? await historyGenerate(request, abortController.signal, "private", appStateContext?.state?.uploadFile?.isFileUploaded, conversationId)
        : await historyGenerate(request, abortController.signal, "private", appStateContext?.state?.uploadFile?.isFileUploaded);
      if (!response?.ok) {
        let errorChatMsg: ChatMessage = {
          id: uuid(),
          role: "error",
          content:
            "There was an error generating a response. Chat history can't be saved at this time. If the problem persists, please contact the site administrator.",
          date: new Date().toISOString(),
        };
        let resultConversation;
        if (conversationId) {
          resultConversation = appStateContext?.state?.chatHistory?.find(
            (conv) => conv.id === conversationId
          );
          if (!resultConversation) {
            console.error("Conversation not found.");
            setIsLoading(false);
            setShowLoadingMessage(false);
            abortFuncs.current = abortFuncs.current.filter(
              (a) => a !== abortController
            );
            return;
          }
          resultConversation.messages.push(errorChatMsg);
        } else {
          setMessages([...messages, userMessage, errorChatMsg]);
          setIsLoading(false);
          setShowLoadingMessage(false);
          abortFuncs.current = abortFuncs.current.filter(
            (a) => a !== abortController
          );
          return;
        }
        appStateContext?.dispatch({
          type: "UPDATE_CURRENT_CHAT",
          payload: resultConversation,
        });
        setMessages([...resultConversation.messages]);
        return;
      }
      if (response?.body) {
        const reader = response.body.getReader();
        let runningText = "";

        while (true) {
          setProcessMessages(messageStatus.Processing);
          const { done, value } = await reader.read();
          if (done) break;

          var text = new TextDecoder("utf-8").decode(value);
          const objects = text.split("\n");
          objects.forEach((obj) => {
            try {
              runningText += obj;
              result = JSON.parse(runningText);
              result.choices[0].messages.forEach((obj) => {
                obj.id = uuid();
                obj.date = new Date().toISOString();
                if (obj.identified_pii && obj.identified_pii?.length > 0) {
                  userMessage.masked_content_user = obj.masked_content_user
                  if (obj?.identified_tokens && obj.identified_tokens?.length !== 0) {
                    userMessage.identified_tokens = obj.identified_tokens
                  }
                }
              });
              setShowLoadingMessage(false);
              if (!conversationId) {
                setMessages([
                  ...messages,
                  userMessage,
                  ...result.choices[0].messages,
                ]);
              } else {
                setMessages([...messages, ...result.choices[0].messages]);
              }
              runningText = "";
            } catch { }
          });
        }

        let resultConversation;
        if (conversationId) {
          resultConversation = appStateContext?.state?.chatHistory?.find(
            (conv) => conv.id === conversationId
          );
          if (!resultConversation) {
            console.error("Conversation not found.");
            setIsLoading(false);
            setShowLoadingMessage(false);
            abortFuncs.current = abortFuncs.current.filter(
              (a) => a !== abortController
            );
            return;
          }
          resultConversation.messages.push(...result.choices[0].messages);
        } else {
          resultConversation = {
            id: result.history_metadata.conversation_id,
            title: result.history_metadata.title,
            messages: [userMessage],
            date: result.history_metadata.date,
          };
          resultConversation.messages.push(...result.choices[0].messages);
        }
        if (!resultConversation) {
          setIsLoading(false);
          setShowLoadingMessage(false);
          abortFuncs.current = abortFuncs.current.filter(
            (a) => a !== abortController
          );
          return;
        }

        const updatedResultConversation = {
          ...resultConversation,
          messages: removeDuplicateMessages(resultConversation?.messages),
        };

        appStateContext?.dispatch({
          type: "UPDATE_CURRENT_CHAT",
          payload: updatedResultConversation,
        });

        setMessages([...messages, ...result.choices[0].messages]);
      }
    } catch (e) {
      if (!abortController.signal.aborted) {
        let errorMessage = errorContent;
        if (result.error?.message) {
          errorMessage = errorContent;
        } else if (typeof result.error === "string") {
          errorMessage = errorContent
        }
        let errorChatMsg: ChatMessage = {
          id: uuid(),
          role: "error",
          content: errorMessage,
          date: new Date().toISOString(),
        };
        let resultConversation;
        if (conversationId) {
          resultConversation = appStateContext?.state?.chatHistory?.find(
            (conv) => conv.id === conversationId
          );
          if (!resultConversation) {
            console.error("Conversation not found.");
            setIsLoading(false);
            setShowLoadingMessage(false);
            abortFuncs.current = abortFuncs.current.filter(
              (a) => a !== abortController
            );
            return;
          }
          resultConversation.messages.push(errorChatMsg);
        } else {
          if (!result.history_metadata) {
            console.error("Error retrieving data.", result);
            setIsLoading(false);
            setShowLoadingMessage(false);
            abortFuncs.current = abortFuncs.current.filter(
              (a) => a !== abortController
            );
            return;
          }
          resultConversation = {
            id: result.history_metadata.conversation_id,
            title: result.history_metadata.title,
            messages: [userMessage],
            date: result.history_metadata.date,
          };
          resultConversation.messages.push(errorChatMsg);
        }
        if (!resultConversation) {
          setIsLoading(false);
          setShowLoadingMessage(false);
          abortFuncs.current = abortFuncs.current.filter(
            (a) => a !== abortController
          );
          return;
        }
        appStateContext?.dispatch({
          type: "UPDATE_CURRENT_CHAT",
          payload: resultConversation,
        });
        setMessages([...messages, errorChatMsg]);
      } else {
        setMessages([...messages, userMessage]);
      }
    } finally {
      setIsLoading(false);
      setShowLoadingMessage(false);
      abortFuncs.current = abortFuncs.current.filter(
        (a) => a !== abortController
      );
      setProcessMessages(messageStatus.Done);
    }
    return abortController.abort();
  };

  //file upload
  const onFileChange = (e: any, isFile?: any) => {
    const uploadedFile = isFile === undefined ? e.target.files[0] : isFile;
    if (uploadedFile && uploadedFile.size > maxFileSize) {
      setIsFileInvalid({
        isInValid: true,
        errorMessage: `File size exceeds the maximum limit ${maxFileSizeInKb}kb. Please choose a smaller file.`
      });
      return;
    }
    const reader: any = new FileReader();
    reader.onloadend = async () => {
      try {
        const typedArray = new Uint8Array(reader.result);
        const pdf = await pdfjs.getDocument({ data: typedArray }).promise;

        if (pdf.numPages > 1) {
          setIsFileInvalid({
            isInValid: true,
            errorMessage: 'You have uploaded a multi-page PDF. We will parse the first page of your PDF since we currently support single-page text PDFs. If you require further assistance, please contact help@protecto.ai.',
            isMultipage: true
          });
        }

        for (let i = 1; i <= 1; i++) {
          const page: any = await pdf.getPage(i);
          const content: any = await page.getTextContent();
          if (content.items.length <= 0) {
            setIsFileInvalid({
              isInValid: true,
              errorMessage: 'Unable to parse the file. Please check the uploaded PDF and try again.'
            });
            return;
          }
        }
        setIsFileUploaded({
          isFileUploaded: true,
          fileName: uploadedFile?.name !== undefined ? uploadedFile?.name : ''
        })
        sendUploadedFile({
          file: uploadedFile,
          fileName: uploadedFile?.name
        });
      }
      catch (error: any) {
        setIsFileUploaded({
          isFileUploaded: false,
        })
        setIsFileInvalid(
          {
            isInValid: true,
            errorMessage: `Error occurred during PDF processing: ${error.message}`
          }
        );
      }
    };

    uploadedFile && reader.readAsArrayBuffer(uploadedFile);
  };

  const handleAddFileDataInMessages = async () => {
    if (appStateContext?.state?.uploadFile?.isFileUploaded) {
      let userMessage: ChatMessage = {
        id: uuid(),
        role: "user",
        isFileContent: true,
        content: appStateContext?.state?.uploadFile?.text ? appStateContext?.state?.uploadFile?.text : "",
        displayContent: 'You are now chatting with GPT Guard based on your uploaded document' + '<br><br>' + '<div><i class="fa fa-file-text-o" style="margin-right:2px"></i> ' + `${appStateContext?.state?.uploadFile?.fileName}</div>`,
        date: new Date().toISOString(),
      };
      let isFileID = appStateContext?.state?.currentChat?.messages.find(obj => obj.isFileContent == true)?.id
      let isFileAvailable = isFileID && isFileID !== null && isFileID !== undefined && isFileID?.length !== 0
      if (!isFileAvailable){
        setMessages([...messages, userMessage]);
        if (appStateContext?.state?.currentChat) {
          appStateContext?.dispatch({
            type: "UPDATE_CURRENT_CHAT",
            payload: {
              ...appStateContext?.state?.currentChat,
              messages: [...messages, userMessage],
            },
          });
          appStateContext?.dispatch({
            type: "UPDATE_CHAT_HISTORY",
            payload: {
              ...appStateContext?.state?.currentChat,
              messages: [...messages, userMessage],
            },
          });
        }
      }
      if (!appStateContext?.state?.currentChat) {
        await setInitialConversation()
          .then(async (response) => {
            if (response) {
              userMessage.conversationId = response?.convId;
              if (response.resultConversation) {
                response.resultConversation.messages = [...messages, userMessage]
                appStateContext?.dispatch({
                  type: "UPDATE_CURRENT_CHAT",
                  payload: response.resultConversation,
                });
                appStateContext?.dispatch({
                  type: "UPDATE_CHAT_HISTORY",
                  payload: response.resultConversation,
                });
              }
            }
          })
      }
    }
  }

  const APIErrorMessageBar: React.FunctionComponent = () => {
    return (
      <>
        {isAPIFailed && (
          <Layer>
            <Popup
              className={popupStyles.root}
              role="dialog"
              aria-modal="true"
              onDismiss={hidePopupAPIError}
              enableAriaHiddenSiblings={true}
            >
              <Overlay onClick={hidePopupAPIError} />
              <FocusTrapZone>
                <div role="document" className={popupStyles.content}>
                  <div className={styles.fileInvalideContainer}>
                    <h2>File Upload API Failed </h2>
                    <p>
                      {
                        appStateContext?.state?.uploadFile?.error
                      }
                    </p>
                    <div className={styles.closebBtn}>
                      <DefaultButton onClick={hidePopupAPIError}>Close</DefaultButton>
                    </div>
                  </div>
                </div>
              </FocusTrapZone>
            </Popup>
          </Layer>
        )}
      </>
    );
  };

  const PopupModalExample: React.FunctionComponent = () => {
    return (
      <>
        {isPopupVisible && (
          <Layer>
            <Popup
              className={popupStyles.root}
              role="dialog"
              aria-modal="true"
              onDismiss={hidePopup}
              enableAriaHiddenSiblings={true}
            >
              <Overlay onClick={hidePopup} />
              <FocusTrapZone>
                <div role="document" className={popupStyles.content}>
                  <div className={styles.fileInvalideContainer}>
                    <h2>{isFileInvalid?.isMultipage ? "Multipage PDF Detected" : " File Invalid"}</h2>
                    <p>
                      {
                        isFileInvalid?.errorMessage
                      }
                    </p>
                    <div className={styles.closebBtn}>
                      <DefaultButton onClick={hidePopup}>Close</DefaultButton>
                    </div>
                  </div>
                </div>
              </FocusTrapZone>
            </Popup>
          </Layer>
        )}
      </>
    );
  };

  return (
    <div className={styles.container} role="main">
      <>
        <Stack horizontal className={styles.chatRoot}>
          <div className={styles.chatContainer}>
            <Stack
              horizontal
              className={styles.newChatContainer}
              role="button"
              aria-label="Clear Chat"
              tabIndex={0}
              onClick={newChat}
              onKeyDown={e => e.key === "Enter" || e.key === " " ? newChat() : null}
            >
              <span className={styles.newChatText} aria-hidden="true">Clear Chat</span>
            </Stack>
            <hr className={styles.chatHeader}>
            </hr>
            <div className={styles.viewContainer}>
              <div className={styles.chatView}>
                {!messages || messages.length < 1 ? (
                  <Stack className={styles.chatEmptyState}>
                    <img
                      src={chatIcon}
                      className={styles.chatIcon}
                      aria-hidden="true"
                    />
                    <h5 className={styles.chatEmptyStateTitle}>Welcome to GPT Guard</h5>
                    <h2 className={styles.chatEmptyStateSubtitle}>Secure and Privacy Preserving Way to Use LLMs</h2>
                  </Stack>
                ) : (
                  <div className={styles.chatMessageStream} style={{ marginBottom: isLoading ? "0px" : "0px" }} role="log">
                    {messages.map((answer, index) => (
                      <>
                        {answer.role === "user" ? (
                          <div>
                            {
                              isData(answer.masked_content_user)
                                ? <div className={`${styles.flipCard} ${answer?.isOpen ? styles.hovered : ''}`}>
                                  <div className={styles.flipCardInner}>
                                    <div className={`${styles.flipFront} ${answer?.isOpen === false ? styles.enable : styles.disable}`}>
                                      <div className={styles.chatMessageUser} tabIndex={0}>
                                        <div className={styles.chatMessageUserMessage}>
                                          <div className={styles.chatMessageUserMessageHeader}>
                                            <div className={styles.chatHeaderText}>Your prompt </div>
                                            <div className={styles.eyeIcon}>{isData(answer.masked_content_user) ?
                                              <div> <img src={eyeIcon} onClick={() => {
                                                setMessages((prevMessages) =>
                                                  prevMessages.map((message) =>
                                                    message.id === answer.id ? { ...message, isOpen: true } : message
                                                  )
                                                );
                                              }} /> </div> : null}</div>
                                          </div>
                                          <div dangerouslySetInnerHTML={{ __html: !answer?.isFileContent ? answer.content : answer?.displayContent || '' }}></div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className={`${styles.flipBack} ${answer?.isOpen === true ? styles.enable : styles.disable}`}>
                                      <div className={styles.chatMessageUser} tabIndex={0}>
                                        <div className={styles.chatMessageUserMessageMasked}>
                                          <div className={styles.chatMessageUserMessageHeader}>
                                            <div className={styles.chatHeaderText}>Masked Prompt Sent to ChatGPT </div>
                                            <div className={styles.eyeIcon}>{isData(answer.masked_content_user) ? <div><img src={eyeOffIcon} onClick={() => {
                                              setMessages((prevMessages) =>
                                                prevMessages.map((message) =>
                                                  message.id === answer.id ? { ...message, isOpen: false } : message
                                                )
                                              );
                                            }} /> </div> : null}</div></div>
                                          <div className={styles.chatMessageContent}>{isData(answer.masked_content_user) ? colorToken(answer?.masked_content_user !== undefined ? answer?.masked_content_user : '',
                                            answer?.identified_tokens !== null && answer?.identified_tokens !== undefined ? answer?.identified_tokens : []) : null}</div>
                                        </div>
                                      </div>
                                    </div>

                                  </div>
                                </div>
                                : <div className={styles.chatMessageUserWithoutMask}>
                                  <div className={styles.chatMessageUserMessageWithoutMask}>
                                    <div className={styles.chatMessageUserMessageHeader}>
                                      <div className={styles.chatHeaderText}>Your prompt </div>
                                    </div>
                                    <div dangerouslySetInnerHTML={{ __html: answer.displayContent || '' }}></div>
                                  </div>
                                </div>
                            }
                          </div>
                        ) : (
                          answer.role === "assistant" ?
                            <div className={styles.chatMessageGpt}>
                              <div className={styles.assistantContainer}>
                                <Answer
                                  answer={{
                                    answer: answer.content,
                                    citations: parseCitationFromMessage(messages[index - 1]),
                                  }}
                                  onCitationClicked={c => onShowCitation(c)}
                                />
                              </div>
                            </div> : answer.role === "error" ? <div className={styles.errorContainer}> <div className={styles.chatMessageErrorContainer}>
                              <div className={styles.chatMessageError}>
                                <Stack horizontal className={styles.chatMessageErrorContent}>
                                  <ErrorCircleRegular className={styles.errorIcon} style={{ color: "rgba(182, 52, 67, 1)" }} />
                                  <span>Error</span>
                                </Stack>
                                <span className={styles.chatMessageErrorContent}>{answer.content}</span>
                              </div>
                              <div className={styles.regenerate}><button
                                className={styles.regenerateContainer}
                                role="button"
                                aria-label="Regenerate"
                                onClick={regenerate}>
                                <span className={styles.regenerateText} >Regenerate</span>
                              </button></div>
                            </div></div> : null
                        )}
                      </>
                    ))}
                    {showLoadingMessage && (
                      <>
                        <div className={styles.dataContainer}>
                          <div className={styles.loaderContent} >
                            <span className={styles.loader}></span>
                          </div>
                        </div>
                        <div className={styles.generateMessageContainer}>
                          <Answer
                            answer={{
                              answer: "Generating answer...",
                              citations: []
                            }}
                            onCitationClicked={() => null}
                          />
                        </div>
                      </>
                    )}
                    <div ref={chatMessageStreamEnd} />
                  </div>
                )}
                <Stack horizontal className={styles.chatInput}>
                  {isLoading && (
                    <Stack
                      horizontal
                      className={styles.stopGeneratingContainer}
                      role="button"
                      aria-label="Stop generating"
                      tabIndex={0}
                      onClick={stopGenerating}
                      onKeyDown={e => e.key === "Enter" || e.key === " " ? stopGenerating() : null}
                    >
                      <SquareRegular className={styles.stopGeneratingIcon} aria-hidden="true" />
                      <span className={styles.stopGeneratingText} aria-hidden="true">Stop generating</span>
                    </Stack>
                  )}
                </Stack>
                <QuestionInput
                  clearOnSend
                  placeholder="Ask..."
                  disabled={isLoading || (!appStateContext?.state?.uploadFile?.isFileUploaded && isFileUploaded.isFileUploaded)}
                  onSend={(question, id) => {
                    appStateContext?.state.isPostgresDBAvailable?.postgresDB ? makeApiRequestWithPostgresDB(trimSpaces(question), id) : makeApiRequestWithPostgresDB(trimSpaces(question), id)
                  }}
                  conversationId={appStateContext?.state.currentChat?.id ? appStateContext?.state.currentChat?.id : undefined}
                />
              </div>
              <div className={styles.fileUploadView} onDrop={handleDrop}
                onDragOver={handleDragOver}>
                <div className={styles.historyHeader}>{
                  !appStateContext?.state?.uploadFile?.isFileUploaded && !isFileUploaded.isFileUploaded
                    ? <span> Upload Document</span>
                    : appStateContext?.state?.uploadFile?.isFileUploaded && !isFileUploaded.isFileUploaded
                      ? <span> Uploaded Document</span>
                      : null}
                </div>
                {
                  isFileInvalid?.isInValid
                    ? <PopupModalExample />
                    : null
                }
                {
                  isAPIError?.isError
                    ? <APIErrorMessageBar />
                    : null
                }
                {
                  !appStateContext?.state?.uploadFile?.isFileUploaded && !isFileUploaded.isFileUploaded
                    ? <div className={styles.fileUploadEmptyState}>
                      <div className={styles.fileUploadTitle}>Chat with document</div>
                      <div className={styles.fileUploadSubTitle}>File types: pdf</div>
                      <div className={styles.fileUploadSubTitle}>File Size: Upto {maxFileSizeInKb} KB</div>
                    </div>
                    : !appStateContext?.state?.uploadFile?.isFileUploaded && isFileUploaded.isFileUploaded
                      ?
                      <div className={`${styles.fileUploadEmptyState} ${styles.override}`}>
                        <ProgressIndicator label="Uploading your document for chat..." description={
                          isFileUploaded?.fileName
                        } percentComplete={progress / 100} />
                        {progress > 0 && <span className={styles.progressText}>{progress}%</span>}
                      </div>
                      : appStateContext?.state?.uploadFile?.isFileUploaded && appStateContext?.state?.uploadFile?.fileName !== ''
                        ?
                        <div className={styles.responseFileWrapper}>
                          <div className={styles.fileWrapper}>
                            <div>Uploaded document ready for chat</div>
                            <div className={styles.removeIconContainer}>
                              <div className={styles.fileNameWrapper}><span onClick={handleFileView}>
                                <div className={styles.fileNameContainer}>
                                  <span className={styles.fileWrap}>  <span><FontIcon aria-label="TextDocument" iconName="TextDocument" className={fileIconClass} /></span>
                                    <TooltipHost
                                      content={appStateContext?.state?.uploadFile?.fileName}
                                      id={tooltipId}
                                      calloutProps={calloutProps}
                                      styles={hostStyles}
                                    >
                                      <span className={styles.fileNameSpace} aria-describedby={tooltipId}>{appStateContext?.state?.uploadFile?.fileName}</span>
                                    </TooltipHost></span>
                                  <img src={eyeIcon} className={styles.eyeFileIcon} onClick={handleFileView} /> </div>
                              </span>
                              </div>
                            </div>
                          </div>
                          <div className={styles.responseFileContainer}><span className={styles.responseContainerText}>Your response will be based on the pdf you have uploaded</span></div>
                        </div>
                        : null
                }
                <div className={styles.fileUploadInput}>
                  <hr style={{ borderTop: '1px solid #E6E6F2', margin: '16px 0' }} />
                  <Stack>
                    <label htmlFor="fileInput" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <img src={uploadIcon}
                        style={{ filter: appStateContext?.state?.uploadFile?.isFileUploaded ? "invert(49%) sepia(5%) saturate(3%) hue-rotate(333deg) brightness(101%) contrast(96%)" : "" }} />
                      <input
                        id="fileInput"
                        type="file"
                        onChange={handleFileChange}
                        onClick={(e) => { const element = e.target as HTMLInputElement; element.value = ''; }}
                        accept=".pdf"
                        style={{ display: 'none' }}
                        disabled={appStateContext?.state?.uploadFile?.isFileUploaded}
                      />
                      <div className={styles.uploadText}>Upload File or drag and drop</div>
                    </label>
                  </Stack>
                </div>
              </div>
            </div>
          </div>
          {messages && messages.length > 0 && isCitationPanelOpen && activeCitation && (
            <Stack.Item className={styles.citationPanel} tabIndex={0} role="tabpanel" aria-label="Citations Panel">
              <Stack aria-label="Citations Panel Header Container" horizontal className={styles.citationPanelHeaderContainer} horizontalAlign="space-between" verticalAlign="center">
                <span aria-label="Citations" className={styles.citationPanelHeader}>Citations</span>
                <IconButton iconProps={{ iconName: 'Cancel' }} aria-label="Close citations panel" onClick={() => setIsCitationPanelOpen(false)} />
              </Stack>
              <h5 className={styles.citationPanelTitle} tabIndex={0}>{activeCitation[2]}</h5>
              <div tabIndex={0}>
                <ReactMarkdown
                  linkTarget="_blank"
                  className={styles.citationPanelContent}
                  children={activeCitation[0]}
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                />
              </div>
            </Stack.Item>
          )}
        </Stack>
        <Dialog
          hidden={!isSharePanelOpen}
          styles={{
            main: [{
              selectors: {
                ['@media (min-width: 480px)']: {
                  maxWidth: '600px',
                  background: "#FFFFFF",
                  boxShadow: "0px 14px 28.8px rgba(0, 0, 0, 0.24), 0px 0px 8px rgba(0, 0, 0, 0.2)",
                  borderRadius: "8px",
                  maxHeight: '200px',
                  minHeight: '130px',
                }
              }
            }]
          }}
          dialogContentProps={{
            title: "Model Fine-Tuning Status",
            showCloseButton: false
          }}
        >
          <Stack horizontal verticalAlign="center" style={{ paddingTop: "10px" }} >
            <div>{trainingStatusText?.success && trainingStatusText?.success !== null ?
              trainingStatusText?.data?.content
              : !trainingStatusText?.success && trainingStatusText?.success !== null
                ? <div className={styles.error}>{trainingStatusText?.error?.message}</div> : null}</div>
          </Stack>
        </Dialog>
        <Dialog
          hidden={!isLoader}
          styles={{
            main: [{
              selectors: {
                ['@media (min-width: 480px)']: {
                  maxWidth: '600px',
                  background: "#FFFFFF",
                  boxShadow: "0px 14px 28.8px rgba(0, 0, 0, 0.24), 0px 0px 8px rgba(0, 0, 0, 0.2)",
                  borderRadius: "8px",
                  maxHeight: '200px',
                  minHeight: '130px',
                }
              }
            }]
          }}
          dialogContentProps={{
            title: "Loading...",
            showCloseButton: false
          }}
        >
          <Spinner size={SpinnerSize.medium} />

        </Dialog>
      </>
      <Panel
        isLightDismiss
        isOpen={isFileViewClicked}
        onDismiss={handleFileViewClose}
        type={PanelType.medium}
        headerText={appStateContext?.state?.uploadFile?.fileName + " - " + "PII Masked"}
        styles={navStyles}
        hasCloseButton={false}
        isFooterAtBottom={true}
        onRenderFooterContent={onRenderFooterContent}
      ><br></br>
        <div>{appStateContext?.state?.uploadFile?.isTokens !== null && appStateContext?.state?.uploadFile?.isTokens ? appStateContext?.state?.uploadFile?.coloredText : appStateContext?.state?.uploadFile?.text || ''}</div>
      </Panel>
    </div >
  );

};

export default Chat;


