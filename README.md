# GPT GUARD

### Keep Your ChatGPT Conversations Secure and Private

Our code is adapted from Microsoft's sample-app-aoai-chatGPT, available here: [https://github.com/microsoft/sample-app-aoai-chatGPT](https://github.com/microsoft/sample-app-aoai-chatGPT).

Explore our advanced GPT Guard web app, crafted by **Protecto.ai** here: [https://www.protecto.ai/](https://www.protecto.ai/). It's tailored to ensure the security and privacy of your ChatGPT conversations. Using GPT Guard, your personally identifiable information (PII) stays private and never visible to large language models (LLMs).

#### Original Source

The original source code can be found at: [https://github.com/microsoft/sample-app-aoai-chatGPT](https://github.com/microsoft/sample-app-aoai-chatGPT)

### GPT Guard 

GPT Guard empowers you to engage in informative and captivating ChatGPT interactions without sacrificing your sensitive information. It acts as a vigilant guardian, protecting your privacy by meticulously shielding personally identifiable information (PII) from the prying eyes of large language models (LLMs).

 #### Automatic PII Detection and Masking:
 -  When you send a prompt, GPT Guard's cutting-edge technology meticulously scans personally identifiable inforamtion(PII). It then expertly masks this sensitive data using Protecto's Data Tokenization APIs, ensuring that your confidential details remain hidden from the LLM.

 #### Understanding Masked Data with a Fine-Tuned OpenAI Model: 
 - GPT Guard doesn't simply mask your data; it understands it. Its specially fine-tuned OpenAI model possesses the unique ability to interpret and respond to masked prompts, ensuring that you receive accurate and relevant responses even when your personal information is protected.

 #### Unmasking for Meaningful Responses
 - Once the model generates a response based on the masked prompt, GPT Guard seamlessly unmasks the PII, revealing the full answer in a way that respects your privacy. This means you can explore a wide range of topics and receive comprehensive answers without fear of exposing sensitive information.

This open-source project leverages **Protecto Tokenization APIs** for PII identification and masking. To use Protecto's APIs, you need to create an account with Protecto.ai [https://www.protecto.ai/](https://www.protecto.ai/).

If you prefer not to sign up and use Protecto APIs, you can replace the masking with your own APIs, following the same input and output structure of Protecto's APIs. Refer to the full [Protecto Tokenization Documentation](https://developer.protecto.ai/docs/protecto-tokenization/) here.

### Privacy Filter

The 'Privacy Filter' - This filter masks PII in your prompts before sending them to LLM, ensure PII remains hidden from the LLM, safeguarding your privacy.

### Protecto's Data Tokenization
Protecto employs a sophisticated approach to data tokenization, ensuring intelligent handling of sensitive information. By leveraging this smart solution, you can unlock the full potential of your data while seamlessly upholding data privacy and security - all through the convenience of an API.

For more information about Protecto Tokenization, please check [here](https://developer.protecto.ai/docs/protecto-tokenization/).
#### Masking

- Before your prompts reach the LLM, GPT Guard carefully scans for any personally identifiable information (PII).
- It identifies the PII, then calls upon **Protecto's Data Tokenization Masking API** to replace that sensitive information with placeholder tokens, ensuring the confidentiality of sensitive details.

#### Unmasking

 - After the LLM crafts a response based on your masked prompt, **Protecto's Data Tokenization Unmask API** precisely swaps the placeholder tokens back with your original PII, restoring the complete information with meticulous accuracy. This ensures you receive a comprehensive and informative response while safeguarding your sensitive data throughout the process.

### Example

Original prompt: "John Smith lives in London"

- PII detected: "John Smith" (name) and "London" (address)

- **GPT Guard masks PII:** Replaces "John Smith" and "London" with placeholder tokens.

- Masked prompt sent to LLM: LLM processes without accessing sensitive information. (**&lt;PER&gt; bRcLfydN0v v5lOgmn7QU &lt;/PER&gt;** lives in **&lt;ADDRESS&gt; 2zgs9AiGpz  &lt;/ADDRESS&gt;**)

- LLM response: Our fine-tuned model is specifically trained to recognize the masked data and respond accordingly. For example it might generates,"&lt;PER&gt; bRcLfydN0v v5lOgmn7QU &lt;/PER&gt;  in &lt;ADDRESS&gt; 2zgs9AiGpz &lt;/ADDRESS&gt; might enjoy the British Museum."

- **GPT Guard unmasks PII:** Restores original names and addresses in the final response. Replaces placeholder tokens with original PII:(**&lt;PER&gt; bRcLfydN0v v5lOgmn7QU &lt;/PER&gt; " becomes "John Smith" &lt;ADDRESS&gt; 2zgs9AiGpz &lt;/ADDRESS&gt;" becomes "London"**)

- Response shown to the users:
  "John Smith, who lives in London, might enjoy visiting the British Museum."
  It contains original PII, but LLM never accessed it directly.

GPT Guard safeguards privacy by shielding PII from LLM. Masking and unmasking ensure informative responses without compromising sensitive data. Users can interact with LLM confidently, knowing their privacy is protected.

#### Privacy Filter has two modes:

1. **Normal Prompts:** Automatically identifies and masks any PII in your typed prompts before sending them to the LLM, ensuring your privacy is protected.

2. **PDF-Based Prompts:** Facilitates private conversations even when discussing information from PDFs. You can upload a PDF file, and the filter will seamlessly extract its text content. Applies the same PII identification, masking, and unmasking process to the extracted text, ensuring confidentiality. The masked text is then sent to the LLM for response generation, allowing you to safely chat about the PDF's contents without revealing sensitive information.

Essentially, GPT Guard safeguards your privacy throughout the entire process, ensuring that your personal information is never exposed to the LLM.

### No-Filter

For users preferring a direct approach without extra processing, the "No-Filter" option is available. Prompts submitted through this filter undergo no alteration or data tokenization and are sent directly to OpenAI without additional steps.
 
## Deploy to Your Local Machine

### Local Setup:
#### Required Packages
- Node.js and npm
  - For installation, refer to the official website: [https://nodejs.org/en/download](https://nodejs.org/en/download)

- Python
  - For installation, refer to the official website: [https://www.python.org/downloads/](https://www.python.org/downloads/)



**Update environment variables:** Update the variables listed in the `.env` file.

   Required variables:

   1. `OPENAI_API_KEY`: This variable must contain your personal OpenAI API key.

   2. `OPENAI_MODEL`: Follow the below fine-tuning instructions to fine-tune the OpenAI model and update the fine-tuned model name in `OPENAI_MODEL` variable.

   3. `BASE_MODEL`: Specify the OpenAI model to be used (gpt-3.5-turbo-1106 preferred).

   4. `TOKENISATION_TOKEN`: Register at [https://trial.protecto.ai/](https://trial.protecto.ai/), and acquire the Auth Key from the Profile section -> Subscription -> Tokenization.


#### Fine-Tune the OpenAI Model
#### **Fine-Tuning Instructions:**
 - **Fine-Tuning Manually:**
    - **Locate the training file:** Find the `training_file.jsonl` file within the `backend/fine_tuning` directory.
    - **Access the fine-tuning script:** Navigate to the `backend/fine_tuning` directory and open the `fine_tuning_model.py` file.
    - **Initiate fine-tuning:** Execute the `fine_tuning_model.py` script to commence the fine-tuning process.
    - **Consult documentation:** For comprehensive details and guidance on fine-tuning, refer to the official OpenAI documentation: [https://platform.openai.com/docs/guides/fine-tuning](https://platform.openai.com/docs/guides/fine-tuning).
    - Follow the instructions to fine-tune the OpenAI model and update the fine-tuned model name in `OPENAI_MODEL` variable.

 - **Automatic Fine-Tuning:**
     - If opting not to fine-tune, leave the `OPENAI_MODEL` value in the `.env` file blank.
     - Ensure that the `OPENAI_API_KEY` is set. The model will be fine-tuned automatically during the process.

     - **After Fine-Tuning:**
       - Once the fine-tuning process is complete, the resulting `OPENAI_MODEL` name will be stored in the `.env` file.

     - **Restart the Application:**
       - Once `.env` file has `OPENAI_MODEL` name, please restart the application.

         - On Linux: `./start.sh`
         - On Windows: `./start.cmd`

#### Initiate the app

   - **Linux:** Initiate the app with `./start.sh`. If you face permissions issues, execute the following command `chmod +x start.sh`,then run the app.

   - **Windows:** Initiate the app with `./start.cmd`. 

This process will build the frontend, install backend dependencies, and then launch the app.

You can view the locally running app at [http://localhost:5000](http://localhost:5000). 

#### Restart the application
  -  To make the environment changes reflect in the application, please restart the application.

#### Want to directly use GPT Guard (as a SaaS)
If you want to use GPT Guard without any installation, please go to [https://www.gptguard.ai/](https://www.gptguard.ai/)

#### Contact Us
- Email us at: [help@protecto.ai](mailto:help@protecto.ai)
- Company website: [https://www.protecto.ai/](https://www.protecto.ai/)


Try out this code and enjoy enhanced privacy and security with GPT Guard. If you have any questions or encounter issues, feel free to reach out to us. 

**Get All the Benefits of ChatGPT Securely Without Sharing Sensitive Data with GPT Guard**




