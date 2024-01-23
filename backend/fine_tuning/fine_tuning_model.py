import os
from time import sleep
import openai
from dotenv import load_dotenv, set_key, find_dotenv


class Fine_Tune:

    def __init__(self):
        self.trained_base_file = str(os.getenv("TRAINING_FILE"))
        self.base_model = str(os.getenv("BASE_MODEL"))

    def create_openai_file(self):
        openai.api_key = str(os.getenv("OPENAI_API_KEY"))
        retry_limit = 3
        retry_count = 0
        while retry_count < retry_limit:
            try:
                create_training_file = openai.File.create(
                    file=open(self.trained_base_file, "rb"),
                    purpose='fine-tune',
                    user_provided_filename=self.trained_base_file)

                file_id = create_training_file['id']
                file_status = create_training_file['status']

                while file_status != "processed":
                    sleep(5)
                    file_details = openai.File.retrieve(file_id)
                    file_status = file_details['status']
                    if file_status == "failed":
                        raise "failed"

                status = self.model_fine_tune(file_id)
                if status == "success":
                    return "success"
                else:
                    return "failed"

            except Exception as error:
                retry_count += 1
                if retry_count >= retry_limit:
                    return "failed"

    def model_fine_tune(self, training_file):
        retry_limit = 3
        retry_count = 0

        while retry_count < retry_limit:
            try:
                finetune_job = openai.FineTuningJob.create(training_file=training_file, model=self.base_model)
                sleep(2)
                job_id = openai.FineTuningJob.retrieve(finetune_job['id'])
                dotenv_path = find_dotenv()
                load_dotenv(dotenv_path)
                key_to_set = "OPENAI_JOB_ID"
                value_to_set = str(job_id["id"])
                set_key(dotenv_path, key_to_set, value_to_set)
                return "success"

            except Exception as error:
                retry_count += 1
                if retry_count >= retry_limit:
                    return "failed"
