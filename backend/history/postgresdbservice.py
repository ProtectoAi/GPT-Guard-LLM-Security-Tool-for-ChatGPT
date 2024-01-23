import threading
import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, class_mapper


class Database:
    __singleton_lock = threading.Lock()
    config = None
    session_maker = None
    db_connection_pool = None

    def __init__(self, user, password, host, database):
        try:
            Database.get_or_initialize_connection_pool(user, password, host, database)
            self.get_conversations("id")
            self.postgres_flag = True
        except Exception as e:
            self.postgres_flag = False

    @classmethod
    def get_or_initialize_connection_pool(cls, user, password, host, database):
        if not cls.db_connection_pool:
            with cls.__singleton_lock:
                if not cls.db_connection_pool:
                    database_url = f"postgresql://{user}:{password}@{host}/{database}"
                    cls.db_connection_pool = create_engine(database_url,
                                                           pool_size=10,
                                                           max_overflow=5,
                                                           pool_pre_ping=True
                                                           )
                    cls.session_maker = sessionmaker(bind=cls.db_connection_pool, autocommit=False)
                    # logger.info("DB connection pool created successfully")

    @classmethod
    def close_connection_pool(cls):
        cls.db_connection_pool.dispose()

    @staticmethod
    def get_session():
        session = Database.session_maker()
        # print("DB connection pool status after creating session: %s" % Database.db_connection_pool.pool.status())
        return session

    @staticmethod
    def close_session(session):
        session.close()
        # logger.info("DB connection pool status after closing session: %s" % Database.db_connection_pool.pool.status())

    def execute_query(self, query, values=None, with_result=False):
        session = None
        result = "No result"
        try:
            session = self.get_session()
            output = session.execute(query, values)
            if with_result:
                result = output.mappings().all()
            session.commit()
            # logger.info("Execution of DB query successful")
            return result
        except Exception as e:
            # logger.error(f"Exception while executing this query {query}: {e}")
            # logger.error(f"{traceback.format_exc()}")
            session.rollback()
            raise e
        finally:
            self.close_session(session)

    def get_conversations(self, user_id, sort_order='DESC'):
        query = f"select * from openai_chat.conversations where user_id = '{user_id}' order by updated_at {sort_order};"
        conversations = self.execute_query(query, with_result=True)

        # if no conversations are found, return None
        if len(conversations) == 0:
            return []
        else:
            return conversations

    def get_conversation(self, conversation_id):
        query = f"select * from openai_chat.conversations where conversation_id = '{conversation_id}';"
        conversation = self.execute_query(query, with_result=True)

        # if no conversations are found, return None
        if len(conversation) == 0:
            return None
        else:
            return conversation[0]

    def upsert_conversation(self, conversation, title=None):
        if title:
            values = {"title": title, "cov_id": str(conversation['conversation_id'])}
            query = ("update openai_chat.conversations set updated_at = now(),title = :title where "
                     "conversation_id = :cov_id")
        else:
            values = {"cov_id": conversation['id']}
            query = (f"update openai_chat.conversations set updated_at = now() "
                     f"where conversation_id = :cov_id")
        resp = self.execute_query(query, values=values)

        if resp == 'No result':
            return resp
        else:
            return False

    def create_conversation(self, user_id, conversation_id, title=''):
        values = {"cov_id": conversation_id, "user_id": user_id, "title": title}
        query = ("insert into openai_chat.conversations(conversation_id,user_id,title) "
                 "values (:cov_id,:user_id,:title);")
        resp = self.execute_query(query, values=values)
        if resp == "No result":
            values = {"cov_id": conversation_id}
            query = "select * from openai_chat.conversations where conversation_id = :cov_id;"
            res = self.execute_query(query, values=values, with_result=True)
            return res[0]
        else:
            return {}

    def create_message(self, conversation_id, input_message: dict, is_file_data=False):
        values = {"msg_id": str(input_message['id']), "cov_id": conversation_id, "role": input_message['role'],
                  "content": input_message['content'], "is_file_data": is_file_data}
        query = ("insert into openai_chat.messages(message_id,conversation_id,role,content,is_file_data) values"
                 "(:msg_id,:cov_id,:role,:content,:is_file_data) ON CONFLICT (message_id) DO NOTHING;")
        resp = self.execute_query(query, values=values)
        if resp:
            # update the parent conversation's updatedAt field with the current message's createdAt datetime value
            con = {"id": conversation_id}
            # conversation = self.get_conversation(user_id, conversation_id)
            self.upsert_conversation(con)
            return resp
        else:
            return False

    def create_message_with_mask(self, conversation_id, input_message: dict):
        values = {"msg_id": str(input_message['id']),
                  "cov_id": conversation_id,
                  "role": input_message['role'],
                  "content": input_message['content'],
                  "masked_content": input_message['masked_content_assistant']}
        query = ("insert into openai_chat.messages(message_id,conversation_id,role,content,masked_content) "
                 "values(:msg_id,:cov_id,:role,:content,:masked_content);")

        resp = self.execute_query(query, values=values)
        if resp:
            # update the parent conversation's updatedAt field with the current message's createdAt datetime value
            con = {"id": conversation_id}
            # conversation = self.get_conversation(user_id, conversation_id)
            self.upsert_conversation(con)
            return resp
        else:
            return False

    def get_messages(self, conversation_id):

        query = (f"select * from openai_chat.messages where conversation_id = '{conversation_id}' "
                 f"order by created_at ASC;")
        messages = self.execute_query(query, with_result=True)

        # if no messages are found, return false
        if len(messages) == 0:
            return []
        else:
            return messages

    def delete_messages(self, conversation_id, user_id):
        # get a list of all the messages in the conversation
        messages = self.get_messages(conversation_id)
        response_list = []
        if messages:
            for message in messages:
                message_id = str(message["message_id"])
                query = f"delete from openai_chat.messages where message_id = '{message_id}';"
                resp = self.execute_query(query)
                response_list.append(resp)
            return response_list

    def delete_conversation(self, user_id, conversation_id):
        if conversation_id:
            query = f"delete from openai_chat.conversations where conversation_id = '{conversation_id}';"
            resp = self.execute_query(query)
            return resp
        else:
            return True

    def update_message(self, message_id, content, pii_identified, identified_tokens):
        values = {"content": content, "pii_identified": str(pii_identified), "msg_id": message_id,
                  "tokens_identified": str(identified_tokens)}
        query = ("update openai_chat.messages set masked_content = :content, pii_identified = :pii_identified, "
                 "tokens_identified = :tokens_identified where message_id = :msg_id;")
        resp = self.execute_query(query, values=values)
        return resp

    def create_user(self, email):
        user_id = uuid.uuid4()
        values = {"user_id": user_id, "email": email}
        query = (f"INSERT INTO openai_chat.users (user_id, user_name) VALUES (:user_id, :email) "
                 f"ON CONFLICT (user_name) DO NOTHING;")
        resp = self.execute_query(query, values=values)
        return resp

    def get_user_id(self, email):
        query = f"select user_id from openai_chat.users where user_name = '{email}'; "
        resp = self.execute_query(query, with_result=True)
        return str(resp[0]['user_id'])
