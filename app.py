import json
import os
import logging
import traceback

import requests
import openai
import tiktoken

from logging.handlers import TimedRotatingFileHandler
from flask import Flask, Response, request, jsonify, send_from_directory, abort
from backend.history.postgresdbservice import Database
from dotenv import load_dotenv, find_dotenv, set_key, dotenv_values
from flask_executor import Executor
from backend.fine_tuning.fine_tuning_model import Fine_Tune
from datetime import datetime
from pdfminer.high_level import extract_text

load_dotenv()

app = Flask(__name__, static_folder="static")
executor = Executor(app)

logging.basicConfig(
    level=logging.DEBUG,
    format="[%(asctime)s] %(levelname)s [%(name)s.%(funcName)s:%(lineno)d] %(message)s",
)

logger = logging.getLogger("my_logger")
logger.setLevel(logging.DEBUG)
log_file = "app.log"
handler = TimedRotatingFileHandler(log_file, when="midnight", interval=1, backupCount=5)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)


# Static Files
@app.route("/")
@app.route("/no-filter")
def index():
    return app.send_static_file("index.html")


@app.route("/favicon.ico")
def favicon():
    return app.send_static_file('favicon.ico')


@app.route("/assets/<path:path>")
def assets(path):
    return send_from_directory("static/assets", path)


# OpenAI Integration Settings
OPENAI_TEMPERATURE = os.environ.get("OPENAI_TEMPERATURE", 0)
OPENAI_TOP_P = os.environ.get("OPENAI_TOP_P", 1.0)
OPENAI_MAX_TOKENS = os.environ.get("OPENAI_MAX_TOKENS", 1000)
OPENAI_STOP_SEQUENCE = os.environ.get("OPENAI_STOP_SEQUENCE")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL")
OPENAI_SYSTEM_MESSAGE = os.environ.get("OPENAI_SYSTEM_MESSAGE")
OPENAI_PDF_SYSTEM_MESSAGE = os.environ.get("OPENAI_PDF_SYSTEM_MESSAGE")
OPENAI_MAX_TOKENS_PROMPT = os.environ.get("OPENAI_MAX_TOKENS_PROMPT", 3000)

# Postgres Integration Settings
POSTGRES_USER = os.environ.get("POSTGRES_USER")
POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD")
POSTGRES_HOST = os.environ.get("POSTGRES_HOST")
POSTGRES_DATABASE = os.environ.get("POSTGRES_DATABASE")
POSTGRES_CLIENT = os.environ.get("POSTGRES_CLIENT")

SHOULD_STREAM = False

#
TOKENISATION_MASK_URL = os.environ.get("TOKENISATION_MASK_URL")
TOKENISATION_UNMASK_URL = os.environ.get("TOKENISATION_UNMASK_URL")
TOKENISATION_TOKEN = os.environ.get("TOKENISATION_TOKEN")

if POSTGRES_CLIENT == "True":
    postgres_db_client = Database(POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_DATABASE)
else:
    postgres_db_client = None
# Initialize a PostgresDB client with AAD auth and containers
cosmos_conversation_client = None


def format_as_ndjson(obj: dict) -> str:
    obj['history_metadata']['date'] = datetime.utcnow().isoformat()
    obj['history_metadata']['conversation_id'] = str(obj['history_metadata']['conversation_id'])
    return json.dumps(obj, ensure_ascii=False) + "\n"


def stream_without_data(response, history_metadata={}):
    response_text = ""
    for line in response:
        delta_text = line["choices"][0]["delta"].get('content')
        if delta_text and delta_text != "[DONE]":
            response_text += delta_text
        response_obj = {
            "id": line["id"],
            "model": line["model"],
            "created": line["created"],
            "object": line["object"],
            "choices": [{
                "messages": [{
                    "role": "assistant",
                    "content": response_text
                }]
            }],
            "history_metadata": history_metadata
        }
        yield format_as_ndjson(response_obj)


def num_tokens_from_string(string: str, encoding_name: str) -> int:
    encoding = tiktoken.encoding_for_model("gpt-3.5-turbo")
    num_tokens = len(encoding.encode(string))
    return num_tokens


def tokenisation_mask_call(content):
    pii_identified = []
    identified_tokens = []

    payload = {"mask": [{"value": content}]}
    headers = {
        "Authorization": f"Bearer {TOKENISATION_TOKEN}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.put(TOKENISATION_MASK_URL, json=payload, headers=headers)
    except Exception as e:
        logger.error(f"Error in mask api call - {str(e)}")
        raise Exception("Error in mask api call")

    try:
        if response.json()["success"]:
            logger.info(f"mask_successful - Response: {response.json()}")
            masked_response = response.json()["data"][0]["token_value"]
        else:
            logger.error(f"Error in mask call - Response : {response.json()}")
            raise Exception("Error in mask api call")
    except Exception as e:
        logger.error(f"Error in mask api call - {str(e)}")
        raise Exception("Error in mask api call")

    try:
        for data in response.json()["data"][0]["individual_tokens"]:
            identified_tokens.append({"key": data['prefix'] + data['token'] + data['suffix']})
            pii_identified.append(data["value"])
    except Exception as e:
        pass

    return masked_response, pii_identified, identified_tokens


def frame_structure_for_public(messages_):
    messages = []
    system_prompt = []

    for message in messages_:
        if message["is_file_data"]:
            system_prompt = [
                {
                    "role": "system",
                    "content": f"{OPENAI_PDF_SYSTEM_MESSAGE} '{message['content']}'"
                }
            ]
            messages = []
        else:
            messages.append({
                "role": message["role"],
                "content": message["content"]
            })
    return system_prompt, messages


def frame_structure_for_private(messages_):
    messages = []
    system_message = []
    pii_identified = []
    identified_tokens = []
    masked_content_user = ""

    for message in messages_:

        if message["masked_content"] is None:
            if message["is_file_data"]:
                content = message["content"]
                masked_response = message["content"]
                system_message = [
                    {
                        "role": "system",
                        "content": f"{OPENAI_PDF_SYSTEM_MESSAGE} '{content}'"
                    }
                ]
                messages = []
            else:
                logger.info(f"Begin - mask_api call with {message['content']}")
                masked_response, pii_identified, identified_tokens = tokenisation_mask_call(message["content"])
                logger.info(f"End - mask_api call response {message['content']}")
                masked_content_user = masked_response
                messages.append({
                    "role": message["role"],
                    "content": masked_response
                })
        else:

            if message["is_file_data"]:
                system_message = [
                    {
                        "role": "system",
                        "content": f"{OPENAI_PDF_SYSTEM_MESSAGE} '{message['masked_content']}'"
                    }
                ]
                messages = []

            else:
                messages.append({
                    "role": message["role"],
                    "content": message["masked_content"]
                })
    return system_message, messages, masked_content_user, pii_identified, identified_tokens


def get_messages(request_body):
    messages_ = request_body.get("messages", [])
    m = []
    user_msg = {}
    for counter, msg in enumerate(messages_, start=1):
        if msg["role"] == "user":
            if "isFileContent" in msg:
                m.append({"role": "user", "content": msg["content"], "is_file_data": True,
                          "masked_content": msg["content"]})
            else:
                if counter < len(messages_):
                    user_msg = msg
                else:
                    m.append({"role": "user", "content": msg["content"], "is_file_data": False,
                              "masked_content": None})
        else:
            m.append({"role": "user", "content": user_msg["content"], "is_file_data": False,
                      "masked_content": msg["masked_content_user"]})
            m.append({"role": "assistant", "content": msg["content"], "is_file_data": False,
                      "masked_content": msg["masked_content_assistant"]})
    messages_ = m
    return messages_


def conversation_without_data(request_body):
    pii_identified = []
    identified_tokens = []
    masked_content_user = ""

    logger.info("Begin conversation_without_data")
    openai.api_key = OPENAI_API_KEY

    user_filter = request_body["filter"]
    is_file_uploaded = request_body["isFileUploaded"]

    messages_ = get_messages(request_body)

    if user_filter == "private":
        system_message, messages, masked_content_user, pii_identified, identified_tokens = (
            frame_structure_for_private(messages_))
    else:
        system_message, messages = frame_structure_for_public(messages_)

    token_length_flag = True
    while token_length_flag:
        if int(OPENAI_MAX_TOKENS_PROMPT) < num_tokens_from_string(str(messages), OPENAI_MODEL):
            messages = messages[1:]
        else:
            token_length_flag = False

    if messages:
        pass
    else:
        logger.error(f"Prompt limit exceeded,shorten your prompt")
        raise Exception("Prompt size limit exceeded")

    if is_file_uploaded:
        messages = system_message + messages
    logger.info(f"Begin openai_api call with {messages}")
    response = openai.ChatCompletion.create(
        model=OPENAI_MODEL,
        messages=messages,
        temperature=float(OPENAI_TEMPERATURE),
        max_tokens=int(OPENAI_MAX_TOKENS),
        top_p=float(OPENAI_TOP_P),
        stop=OPENAI_STOP_SEQUENCE.split("|") if OPENAI_STOP_SEQUENCE else None,
        stream=bool(SHOULD_STREAM),
        frequency_penalty=0,
        presence_penalty=0
    )
    logger.info(f"End openai_api response with {response.choices[0].message.content}")

    history_metadata = {
        "conversation_id": request_body["conversation_id"],
        "title": "chat",
        "date": datetime.utcnow().strftime("%a, %d %b %Y, %H:%M:%S") + " GMT"
    }

    if not SHOULD_STREAM:
        if user_filter == 'private':
            masked_assistant_response = response.choices[0].message.content
            payload = {"unmask": [{"token_value": masked_assistant_response}]}
            headers = {
                "Authorization": f"Bearer {TOKENISATION_TOKEN}",
                "Content-Type": "application/json"
            }
            logger.info(f"Begin unmask_api call with {masked_assistant_response}")
            try:
                result = requests.put(TOKENISATION_UNMASK_URL, json=payload, headers=headers)
            except Exception as e:
                logger.error(f"Error in unmask api call - {str(e)}")
                raise e
            logger.info(f"End unmask_api call response {result}")
            content_response = result.json()["data"][0]["value"]
        else:
            content_response = response.choices[0].message.content
            masked_assistant_response = None

        response_obj = {
            "id": response,
            "model": response.model,
            "created": response.created,
            "object": response.object,
            "choices": [{
                "messages": [{
                    "role": "assistant",
                    "content": content_response,
                    "masked_content_assistant": masked_assistant_response,
                    "masked_content_user": masked_content_user,
                    "identified_pii": pii_identified,
                    "identified_tokens": identified_tokens

                }]
            }],
            "history_metadata": history_metadata
        }
        logger.info("End conversation_without_data")
        return jsonify(response_obj), 200
    else:
        return Response(stream_without_data(response, history_metadata), mimetype='text/event-stream')


@app.route("/conversation", methods=["GET", "POST"])
def conversation():
    request_body = request.json
    return conversation_internal(request_body)


def conversation_internal(request_body):
    try:
        return conversation_without_data(request_body)
    except Exception as e:
        logging.exception("Exception in /conversation")
        logger.error(traceback.format_exc())
        logger.error(f"Error in conversation_internal - {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/menus", methods=["GET"])
def menus():
    logger.info("request received- /menus")
    menu = [
        {
            "link": "/",
            "key": "privacy-filter",
            "name": "Privacy Filter",
            "icon": "Lock",
            "children": [

            ]
        },
        {
            "link": "/no-filter",
            "key": "no-filter",
            "name": "No Filter",
            "icon": "Lock",
            "children": [

            ]
        }
    ]

    response = {"data": menu, "success": True, "error": {"message": ""}}
    return jsonify(response), 200


def create_folder_if_not_exists(folder_path):
    try:
        if not os.path.exists(folder_path):
            os.makedirs(folder_path)
            logger.info(f"Folder '{folder_path}' created successfully.")
        else:
            logger.info(f"Folder '{folder_path}' already exists.")
    except Exception as e:
        logger.error(f"Error creating folder '{folder_path}': {e}")


def delete_files_in_directory(directory_path):
    try:
        for filename in os.listdir(directory_path):
            file_path = os.path.join(directory_path, filename)
            if os.path.isfile(file_path):
                os.remove(file_path)
                logger.info(f"File '{filename}' deleted successfully.")
    except Exception as e:
        logger.error(f"Error deleting files in directory '{directory_path}': {e}")


# Example usage:

@app.route("/upload-file", methods=["PUT"])
def upload_file():
    try:
        logger.info("request received- /upload_file")
        if not postgres_db_client:
            pass
        else:
            email = request.headers['email']
            postgres_db_client.create_user(email)

        if 'pdfFile' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        pdf_file = request.files['pdfFile']
        text_filter = request.form['filter']
        # filter_content = request.files['filter'].read()
        # text_filter = filter_content.decode('utf-8')
        # Process the file as needed, for example, save it to disk
        create_folder_if_not_exists("uploaded_files")

        pdf_file.save('uploaded_files/' + pdf_file.filename)
        pdf_path = f"uploaded_files/{pdf_file.filename}"
        try:
            text = extract_text(pdf_path, page_numbers=[0])
            if text.strip():  # Check if extracted text is not empty
                # Process the extracted text as needed
                pass
            else:
                raise Exception("PDF has no text on the first page.")

        except Exception as e:
            logger.warning(f"Error on parsing file - {pdf_path}")
            return jsonify({
                "fileInvalid": {
                    "message": os.environ.get("ERROR_MESSAGE_FOR_PARSING_FILE")
                },
                "success": True,
                "error": {
                    "message": f"{str(e)}"
                }
            })

        delete_files_in_directory("uploaded_files")

        if text_filter == "public":
            return jsonify({"data": {
                "text": text
            },
                "success": True,
                "error": {
                    "message": "",
                },
            })
        else:
            masked_text, pii, tokens = tokenisation_mask_call(text)
            return jsonify({"data": {
                "text": masked_text,
                "identified_tokens": tokens
            },
                "success": True,
                "error": {
                    "message": "",
                },
            })

    except Exception as e:
        response = jsonify({"error": str(e)})
        logger.error(f"Exception in /history/upload-file Error - {str(e)}")
        logger.error(traceback.format_exc())
        return response, 500


# Conversation History API #
@app.route("/history/generate", methods=["POST"])
def add_conversation():
    logger.info("request received- /generate")
    if not postgres_db_client:
        request_body = request.json
        return conversation_internal(request_body)
    else:
        email = request.headers['email']
        postgres_db_client.create_user(email)
        user_id = postgres_db_client.get_user_id(email)
        # check request for conversation_id
        logger.info(f"User id: {user_id} t Api: history/generate")
        try:
            conversation_id = request.json.get("conversation_id", None)
            # check for the conversation_id, if the conversation is not set, we will create a new one
            messages = request.json["messages"]
            if len(messages) > 0 and messages[-1]['role'] == "user":
                pass
            else:
                raise Exception("No user message found")

            # Submit request to Chat Completions for response
            request_body = request.json
            request_body["conversation_id"] = str(conversation_id)
            postgres_db_client.update_interaction(user_id)
            return conversation_internal(request_body)

        except Exception as e:
            response = jsonify({"error": str(e)})
            logger.error(f"Exception in /history/generate Error - {str(e)}")
            logger.error(traceback.format_exc())
            return response, 500


@app.route("/history/ensure", methods=["GET"])
def ensure_postgres():
    return jsonify({"message": "PostgresDB is configured and working"}), 200


def long_running_task():
    key_to_set = "JOB_ID_STATUS"
    dotenv_path = find_dotenv()
    load_dotenv(dotenv_path)
    pending_status = "PENDING"
    set_key(dotenv_path, key_to_set, pending_status)
    result = Fine_Tune().create_openai_file()
    if result == "success":
        value_to_set = "SUCCESS"
        set_key(dotenv_path, key_to_set, value_to_set)
    else:
        value_to_set = "FAILED"
        set_key(dotenv_path, key_to_set, value_to_set)


@app.route("/training", methods=["GET"])
def training():
    env_values = dotenv_values(find_dotenv())
    openai_api_key = "OPENAI_API_KEY"
    openai_api_value = env_values.get(openai_api_key)

    if not openai_api_value:
        return jsonify({
            'data': {},
            'success': False,
            'error': {
                'message': 'Open API key missing',
            },
        }), 500

    if env_values["OPENAI_MODEL"] != "":
        return jsonify({
            'data': {
                'content': 'Fine-tuning operation completed. Please refresh the page.',
                'status': True
            },
            'success': True,
            'error': {
                'message': '',
            },
        }), 200
    else:
        jobid_status = "JOB_ID_STATUS"

        if jobid_status not in env_values:
            if env_values["TRAINING_FILE"] == "" or env_values["BASE_MODEL"] == "":
                return jsonify({
                    'data': {
                        'content': "TRAINING_FILE or BASE_MODEL environment variable is empty or not set.",
                        'status': False
                    },
                    'success': True,
                    'error': {
                        'message': '',
                    },
                }), 200

            else:
                executor.submit(long_running_task)
                return jsonify({
                    'data': {
                        'content': "Fine-tuning operation is currently in progress",
                        'status': False
                    },
                    'success': True,
                    'error': {
                        'message': '',
                    },
                }), 200

        elif env_values["JOB_ID_STATUS"] == "FAILED":
            executor.submit(long_running_task)
            return jsonify({
                'data': {
                    'content': "Fine-tuning operation had failed and retrying",
                    'status': False
                },
                'success': True,
                'error': {
                    'message': '',
                },
            }), 200

        else:
            env_val = env_values["JOB_ID_STATUS"]
            if env_val == "PENDING":
                return jsonify({
                    'data': {
                        'content': 'Fine-tuning operation is currently in progress',
                        'status': False
                    },
                    'success': True,
                    'error': {
                        'message': '',
                    },
                }), 200

            else:
                try:
                    openai.api_key = openai_api_value
                    job_id = env_values["OPENAI_JOB_ID"]
                    job_status = openai.FineTuningJob.retrieve(job_id)["status"]

                    if job_status == 'succeeded':
                        fine_tuned_model = openai.FineTuningJob.retrieve(job_id)["fine_tuned_model"]
                        dotenv_path = find_dotenv()
                        load_dotenv(dotenv_path)
                        key_to_set = "OPENAI_MODEL"
                        value_to_set = str(fine_tuned_model)
                        set_key(dotenv_path, key_to_set, value_to_set)
                        return jsonify({
                            'data': {
                                'content': 'Fine-tuning operation completed. Please refresh the page.',
                                'status': True
                            },
                            'success': True,
                            'error': {
                                'message': '',
                            },
                        }), 200

                    elif job_status in ['failed', "cancelled"]:
                        return jsonify({
                            'data': {},
                            'success': False,
                            'error': {
                                'message': 'An error occurred in while fine-tuning model',
                            },
                        }), 500

                    else:
                        return jsonify({
                            'data': {
                                'content': 'Fine-tuning operation is still currently in progress',
                                'status': False
                            },
                            'success': True,
                            'error': {
                                'message': '',
                            },
                        }), 200

                except Exception as error:
                    return jsonify({
                        'data': {},
                        'success': False,
                        'error': {
                            'message': str(error),
                        },
                    }), 500


if __name__ == "__main__":
    app.run()
