import { useState } from "react";
import { Stack, TextField } from "@fluentui/react";
import Send from "../../assets/send.svg";
import styles from "./QuestionInput.module.css";

interface Props {
    onSend: (question: string, id?: string) => void;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
    conversationId?: string;
}

export const QuestionInput = ({ onSend, disabled, placeholder, clearOnSend, conversationId }: Props) => {
    const [question, setQuestion] = useState<string>("");

    const sendQuestion = () => {
        if (disabled || !question.trim()) {
            return;
        }

        if(conversationId){
            onSend(question, conversationId);
        }else{
            onSend(question);
        }

        if (clearOnSend) {
            setQuestion("");
        }
    };

    const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
            ev.preventDefault();
            sendQuestion();
        }
    };

    const onQuestionChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setQuestion(newValue || "");
    };

    const sendQuestionDisabled = disabled || !question.trim();

    return (
        <Stack horizontal className={styles.questionInputContainer}>
            <TextField
                className={styles.questionInputTextArea}
                placeholder={placeholder}
                multiline
                resizable={false}
                borderless
                value={question}
                onChange={onQuestionChange}
                onKeyDown={onEnterPress}
                styles={{
                    fieldGroup: {
                        paddingTop: '9px',
                        minHeight: '48px'
                    },
                    field: {
                        whiteSpace: 'pre-wrap',
                        maxWidth: '80%',
                        minHeight: '80px'
                    }
                }}
            />
            <div className={sendQuestionDisabled ? styles.questionInputSendButtonDisabled : styles.questionInputSendButtonContainer} 
                role="button" 
                tabIndex={0}
                aria-label="Ask question button"
                onClick={sendQuestion}
                onKeyDown={e => e.key === "Enter" || e.key === " " ? sendQuestion() : null}
            >
                { sendQuestionDisabled ? (
                    <div className={styles.sendButtonContent}>
                    <img src={Send} className={styles.questionInputSendButton} />
                    <span className={styles.questionInputSendButtonText} aria-hidden="true">Send</span>
                    </div>                    ):(
                    <div className={styles.sendButtonContent}>
                    <img src={Send} className={styles.questionInputSendButton} />
                    <span className={styles.questionInputSendButtonText} aria-hidden="true">Send</span>
                    </div>
                )}
            </div>
        </Stack>
    );
};
