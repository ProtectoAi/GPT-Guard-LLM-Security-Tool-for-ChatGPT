CREATE SCHEMA openai_chat;

CREATE TABLE IF NOT EXISTS openai_chat.users
(
    user_id uuid NOT NULL,
    user_name character varying NOT NULL UNIQUE ,
    CONSTRAINT users_pkey PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS openai_chat.conversations
(
    conversation_id uuid NOT NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id uuid,
    title character varying NOT NULL,
    CONSTRAINT conversations_pkey PRIMARY KEY (conversation_id),
    CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES openai_chat.users (user_id)
);

CREATE TABLE IF NOT EXISTS openai_chat.messages
(
    message_id uuid NOT NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    conversation_id uuid,
    role character varying NOT NULL,
    content text,
    masked_content text,
    pii_identified text,
    is_file_data boolean DEFAULT false,
    tokens_identified text,-- New column
    CONSTRAINT messages_pkey PRIMARY KEY (message_id),
    CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id)
        REFERENCES openai_chat.conversations (conversation_id)
);
