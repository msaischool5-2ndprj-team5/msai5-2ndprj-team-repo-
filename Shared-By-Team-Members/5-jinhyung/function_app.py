import os, sys, uuid, logging, json, requests, datetime, ast
import azure.functions as func
# import azurefunctions.extensions.bindings.blob as blob

from zoneinfo import ZoneInfo
from openai import AzureOpenAI
from azure.storage.blob import BlobServiceClient
from azure.cognitiveservices.speech import SpeechConfig, SpeechSynthesizer, AudioConfig, ResultReason, CancellationReason

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)
CONNECT_STR = os.getenv('AzureWebJobsStorage')
CONTAINER_NAME = os.getenv('BlobContainerName')
SPEECH_SERVICE_REGION = os.getenv('SpeechServiceRegion')
SPEECH_KEY = os.getenv('SpeechServiceKey')
OPENAI_SERVICE_GPT4O_ENDPOINT = os.getenv('OpenAIServiceEndpointSwedenCentral')
OPENAI_SERVICE_GPT4O_KEY = os.getenv('OpenAIServiceKeySwedenCentral')
OPENAI_SERVICE_DALLE3_ENDPOINT = os.getenv('OpenAIServiceEndpointEastUs')
OPENAI_SERVICE_DALLE3_KEY = os.getenv('OpenAIServiceKeyEastUs')
CHAT_HIST_FILE_NAME = "chat_hist.json"
TODO_LIST_FILE_NAME = "todo_list.json"

gpt4o_client = AzureOpenAI(
    azure_endpoint = OPENAI_SERVICE_GPT4O_ENDPOINT,
    api_key=OPENAI_SERVICE_GPT4O_KEY,  
    api_version="2024-02-15-preview"
)

@app.route(route="handle_schedule_with_gpt", methods=["POST"])
def handle_schedule_with_gpt(req: func.HttpRequest) -> func.HttpResponse:
    """POST
    params:
    - Mandatories
    name | prop
    ---------------
    user_id | user UUID

    body: str(gpt-4o-realtime response['transcript'])

    Return: str(json)
    """
    logging.info(f'{sys._getframe(0).f_code.co_name} : Python HTTP trigger function processed a request.')

    try:
        user_id = req.params.get('user_id')
        if not user_id:
            user_id = "c0ff4b5b-3c2d-4335-a057-33e48c565f1e"
        str_body = str(req.get_body())
    except ValueError:
        return func.HttpResponse(status_code=400)

    first_response = gpt4o_client.chat.completions.create(
        model="gpt-4o", # model = "deployment_name".
        messages=[
            {
                "role": "system",
                "content": "어시스턴스가 사용자에게 제공한 답변이 입력으로 제공되며, 그 내용 중에서 사용자의 일정 또는 약속에 대한 내용이 있다면 True, 없다면 False를 출력합니다. 그 외의 어떠한 출력도 허용되지 않습니다."
            },
            {
                "role": "assistant",
                "content": str_body
            }
        ]
    )

    first_response_content = first_response.choices[0].message.content

    if first_response_content.lower() == "true":
        current_time = datetime.datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M %p")

        blob_service_client = BlobServiceClient.from_connection_string(CONNECT_STR)
        hist_blob_path = os.path.join(user_id, CHAT_HIST_FILE_NAME)
        container_client = blob_service_client.get_container_client(CONTAINER_NAME)
        result = container_client.download_blob(hist_blob_path, encoding="UTF-8").readall()
        result_json = json.loads(result)[1:]

        messages = [
            {
                "role": "system", 
                "content": f"현재 시간은 {current_time}이며, " + '''
                    사용자는 전체 대화 기록을 너에게 제공한다.
                    그리고 전체 대화 기록을 통해 기존에 만들어진 일정 및 약속, 계획 등에 대한 json 리스트 데이터를 너에게 제공될 수도, 제공되지 않을 수도 있다. 
                    너는 주어진 데이터에서 일정 및 약속, 계획 등에 대한 것을 다음과 같이 json 리스트 형태로 정리하여야 한다.
                    [{"date": date(yyyy-mm-dd),"time": time(hh:MM),"destination": str,"purpose": str,"is_done": bool,"comment": str}]
                    앞뒤 문맥을 잘 살피고, 주어진 데이터의 키값 중 time을 통해 날짜와 시간을 확인해 보았을 때, 동일하거나 중복되는 일정은 없어야 한다.
                    입력으로 제공받은 전체 대화 기록과 json 리스트 데이터를 비교해 보았을 때, 틀리거나 잘못 기입된 데이터에 대해 수정 및 삭제할 수 있다.
                    이때, 데이터 수정이 필요한 경우, 전체 대화 기록이 옳은 데이터이므로 이를 기준으로 수정해야 한다.
                    위 json 포맷 중 comment 항목은 어시스턴스가 일정에 대해 좀 더 정확한 정보를 사용자에게 요구하거나 데이터의 수정이 이루어졌을 경우에 어떤 부분에서 변경이 되었는지 알려주는 항목이다.
                    그 외의 어떠한 출력도 허용되지 않는다.
                '''
            }
        ]
        messages.append({"role": "user", "content": f"전체 대화 기록은 다음과 같다.\n{result_json}"})

        todo_blob_path = os.path.join(user_id, TODO_LIST_FILE_NAME)
        todo_list_file = blob_service_client.get_blob_client(CONTAINER_NAME, f"{user_id}/{TODO_LIST_FILE_NAME}")
        if todo_list_file.exists():
            todo_list = container_client.download_blob(todo_blob_path, encoding="UTF-8").readall()
            messages.append({"role": "user", "content": f"기존에 만들어진 일정 및 약속, 계획 등에 대한 json 리스트 데이터는 다음과 같다.\n{str(todo_list)}"})
        # logging.info(f"{messages}")

        second_response = gpt4o_client.chat.completions.create(
            model="gpt-4o", # model = "deployment_name".
            messages=messages
        )

        todo_data = second_response.choices[0].message.content
        if isinstance(todo_data, (str)):
            todo_data = json.dumps(json.loads(todo_data), ensure_ascii=False, indent=4)
        elif isinstance(todo_data, (list)):
            todo_data = json.dumps(todo_data, ensure_ascii=False, indent=4)

        todo_list_file.upload_blob(todo_data, overwrite=True)

        return func.HttpResponse(todo_data)
    else:
        return func.HttpResponse(str(first_response_content))



@app.route(route="get_todo", methods=["GET"])
def get_todo(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user_id = req.params.get('user_id')
        from_date = req.params.get('from_date')
        if not user_id:
            user_id = "c0ff4b5b-3c2d-4335-a057-33e48c565f1e"
        if not from_date:
            from_date = 0
    except ValueError:
        return func.HttpResponse(status_code=400)

    blob_service_client = BlobServiceClient.from_connection_string(CONNECT_STR)
    hist_blob_path = os.path.join(user_id, TODO_LIST_FILE_NAME)
    container_client = blob_service_client.get_container_client(CONTAINER_NAME)
    todo_list = container_client.download_blob(hist_blob_path, encoding="UTF-8").readall()

    if from_date:
        current_time = datetime.datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M %p")
        response = gpt4o_client.chat.completions.create(
            model="gpt-4o", # model = "deployment_name".
            messages=[
                {
                    "role": "system",
                    "content": f"현재 날짜와 시간은 {current_time}이며, 주어진 json 리스트 데이터에서 현재로부터 {from_date}일이 지난 데이터는 제외하고 출력하라. 그 외의 출력은 허용되지 않는다."
                },
                {
                    "role": "user",
                    "content": str(todo_list)
                }
            ]
        )

        response_content = response.choices[0].message.content
        return func.HttpResponse(response_content)
    else:
        return func.HttpResponse(todo_list)



@app.route(route="create_image")
def create_image(req: func.HttpRequest) -> func.HttpResponse:
    """GET
    params:
    - Mandatories
    name | prop
    ---------------
    prompt | User prompt to send dall-e-3

    Return: bytes(image)
    """
    logging.info(f'{sys._getframe(0).f_code.co_name} : Python HTTP trigger function processed a request.')
    
    try:
        prompt = req.params.get('prompt')
        if not prompt:
            prompt = "나를 향해 인사하는 한국인의 모습"
    except:
        prompt = "나를 향해 인사하는 한국인의 모습"
    logging.debug(f"Prompt : {prompt}")

    client = AzureOpenAI(
        azure_endpoint = OPENAI_SERVICE_DALLE3_ENDPOINT,
        api_key=OPENAI_SERVICE_DALLE3_KEY,
        api_version="2024-02-15-preview"
    )

    result = client.images.generate(
        model="dall-e-3", # the name of your DALL-E 3 deployment
        prompt=prompt,
        n=1
    )

    json_response = json.loads(result.model_dump_json())

    # Retrieve the generated image
    image_url = json_response["data"][0]["url"]

    generated_image = requests.get(image_url).content
    return func.HttpResponse(generated_image)



@app.route(route="set_hist", methods=["POST"])
def set_history(req: func.HttpRequest) -> func.HttpResponse:
    """POST
    params:
    - Mandatories
    name | prop
    ---------------
    user_id | user UUID

    body: str(gpt-4o-realtime response['transcript'])

    Return: str(json({"is_success": bool}))
    """
    logging.info(f'{sys._getframe(0).f_code.co_name} : Python HTTP trigger function processed a request.')
    current_time = datetime.datetime.now(ZoneInfo("Asia/Seoul")).replace(microsecond=0)

    try:
        # Get the user's UUID from request params
        user_id = req.params.get('user_id')
        if not user_id:
            user_id = "c0ff4b5b-3c2d-4335-a057-33e48c565f1e"
        str_body = req.get_body().decode()
    except ValueError as err:
        return func.HttpResponse(f"{err}", status_code=400)
    logging.debug(f"Request Body: {str_body}")

    prep_data = {
        "role": "asisstant",
        "content": str_body,
        "datetime": str(current_time)
    }
    
    # Create the BlobServiceClient object
    blob_service_client = BlobServiceClient.from_connection_string(CONNECT_STR)
    
    # Set a path in blob storage
    blob_path = os.path.join(user_id, CHAT_HIST_FILE_NAME)

    # Create a blob client
    blob_client = blob_service_client.get_blob_client(container=CONTAINER_NAME, blob=blob_path)

    history = ast.literal_eval(blob_client.download_blob(encoding="UTF-8").readall())
    history.append(prep_data)
    history = json.dumps(history, indent=4, ensure_ascii=False)

    # Upload(+Overwrite) chat_hist.json
    blob_client.upload_blob(data=history, overwrite=True)

    # Return json
    return func.HttpResponse(str({"is_success": True, "set_data": prep_data}), status_code=200)



@app.route(route="get_hist")
def get_history(req: func.HttpRequest) -> func.HttpResponse:
    """GET
    params:
    - Mandatories
    name | prop
    ---------------
    user_id | user UUID

    Return: str(json)
    """
    logging.info(f'{sys._getframe(0).f_code.co_name} : Python HTTP trigger function processed a request.')

    # Create the BlobServiceClient object
    logging.debug("Create blob_service_client Start")
    blob_service_client = BlobServiceClient.from_connection_string(CONNECT_STR)
    logging.debug("Create blob_service_client Done")

    # Get params in request
    logging.debug("Get params Start")
    user_id = req.params.get('user_id')
    if not user_id:
        user_id = "c0ff4b5b-3c2d-4335-a057-33e48c565f1e"
    logging.debug("Get params Done")

    # Set a path in blob storage
    logging.debug("Join blob_path Start")
    blob_path = os.path.join(user_id, CHAT_HIST_FILE_NAME)
    logging.debug("Join blob_path Done")

    # Create the container client
    logging.debug("Create container_client Start")
    container_client = blob_service_client.get_container_client(CONTAINER_NAME)
    # logging.debug(f"{vars(container_client)}")
    logging.debug("Create container_client Done")

    logging.debug("Read contents Start")
    result = container_client.download_blob(blob_path, encoding="UTF-8").readall()
    # logging.info(f"Get contents : {result.container}, {result.name}")
    logging.debug("Read contents Done")

    # Return the blob_path contents
    return func.HttpResponse(result)



@app.route(route="sign_up")
def sign_up(req: func.HttpRequest) -> func.HttpResponse:
    """GET
    no headers

    Return: str(json({"uuid": user_id}))
    """
    logging.info(f'{sys._getframe(0).f_code.co_name} : Python HTTP trigger function processed a request.')

    # Create the BlobServiceClient object
    logging.debug("Create blob_service_client Start")
    blob_service_client = BlobServiceClient.from_connection_string(CONNECT_STR)
    logging.debug("Create blob_service_client Done")

    # Create a user's UUID (for production)
    logging.debug("Create user's UUID Start")
    user_id = str(uuid.uuid4())
    # # Create a user's UUID (for development)
    # user_id = req.params.get('user_id')
    # if not user_id:
    #     user_id = "."

    logging.info(f'A new account has been registered. User UUID is {user_id}')
    logging.debug("Create user's UUID Done")
    
    # Set a path in blob storage
    logging.debug("Set blob_path Start")
    blob_path = os.path.join(user_id, CHAT_HIST_FILE_NAME)
    logging.debug("Set blob_path Done")

    # Create a blob client
    logging.debug("Create blob_client Start")
    blob_client = blob_service_client.get_blob_client(container=CONTAINER_NAME, blob=blob_path)
    logging.debug(vars(blob_client))
    logging.debug("Create blob_client Done")

    # Upload chat_hist.json
    logging.debug(f"Upload {CHAT_HIST_FILE_NAME} into Blob Storage Start")
    with open(CHAT_HIST_FILE_NAME, "rb") as f:
        blob_client.upload_blob(f)
    logging.debug(f"Upload {CHAT_HIST_FILE_NAME} into Blob Storage Done")

    # Return user_id
    return func.HttpResponse(str({"uuid": user_id}))



@app.route(route="init")
def init(req: func.HttpRequest) -> func.HttpResponse:
    logging.info(f'{sys._getframe(0).f_code.co_name} : Python HTTP trigger function processed a request.')

    # Check the Blob Container exists
    blob_service_client = BlobServiceClient.from_connection_string(CONNECT_STR)

    container = blob_service_client.get_container_client(CONTAINER_NAME)
    if container.exists():
        return func.HttpResponse("OK")
    else:
        return func.HttpResponse("Failed")

    # containers = blob_service_client.list_containers(name_starts_with='users')
    # container_exists = False
    # for container in containers:
    #     if container.name == "users":
    #         container_exists = True
    #         logging.info(f"'{CONTAINER_NAME}' Container exists")
    #         break

    ## Create the Container if the Blob Container does not exist
    # if container_exists:
    #     container_client = blob_service_client.get_container_client(CONTAINER_NAME)
    # else:
    #     container_client = blob_service_client.create_container(CONTAINER_NAME)

    # return func.HttpResponse("OK")

#############################################################



# HTTP Trigger의 Request Param으로 user_id 받아서 good_morning() 등 메소드의 결과물을
# user UUID 폴더에 넣게끔 수정해 주시면 될 것 같습니다.

def good_morning(user_id, message):
    speech_config = SpeechConfig(subscription=SPEECH_KEY, region=SPEECH_SERVICE_REGION)
    speech_config.speech_synthesis_voice_name = "ko-KR-SunHiNeural"
    audio_config = AudioConfig(filename="good_morning.wav")

    synthesizer = SpeechSynthesizer(speech_config=speech_config, audio_config=audio_config)
    
    result = synthesizer.speak_text_async(message).get()

    if result.reason == ResultReason.SynthesizingAudioCompleted:
        logging.info("Speech synthesis succeeded.")
        upload_soundfile(user_id,"good_morning.wav")
    elif result.reason == ResultReason.Canceled:
        cancellation_details = result.cancellation_details
        logging.error(f"Speech synthesis canceled: {cancellation_details.reason}")
        if cancellation_details.reason == CancellationReason.Error:
            logging.error("Error details: {}".format(cancellation_details.error_details))

def upload_soundfile(user_id, file_name):
    BLOB_NAME = file_name
    
    blob_service_client = BlobServiceClient.from_connection_string(CONNECT_STR)

    blob_path = os.path.join(user_id, BLOB_NAME)

    blob_client= blob_service_client.get_blob_client(container=CONTAINER_NAME, blob=blob_path)

    logging.info("\nUploading to Azure Storage as blob:\n\t" + BLOB_NAME)

    # Upload to blob
    with open(file=BLOB_NAME, mode="rb") as data:
        blob_client.upload_blob(data=data, overwrite=True)

def download_audiofile(user_id, file_name):
    BLOB_NAME = file_name
    
    # 연결 문자열로 연결
    blob_service_client = BlobServiceClient.from_connection_string(CONNECT_STR)
    
    blob_path = os.path.join(user_id, BLOB_NAME)
    
    # 컨테이너 설정
    container_client = blob_service_client.get_container_client(CONTAINER_NAME)
    
    logging.info(blob_path)
    
    result = container_client.download_blob(blob_path).readall()
    
    return result

def upload_schedule(user_id, schedule):
    BLOB_NAME = "schedule.txt"
    
    blob_path = os.path.join(user_id, BLOB_NAME)
    
    #blob storage에 스케줄 저장
    blob_service_client = BlobServiceClient.from_connection_string(CONNECT_STR)
    blob_client= blob_service_client.get_blob_client(container=CONTAINER_NAME, blob=blob_path)
    
    try:
        blob_client.upload_blob(schedule, overwrite=True)
        logging.info("Schedule updated.")
    except Exception as e:
        logging.info(e)

def get_schedule():
    BLOB_NAME = "schedule.txt"
    
    blob_service_client = BlobServiceClient.from_connection_string(CONNECT_STR)
    blob_client= blob_service_client.get_blob_client(container=CONTAINER_NAME, blob=BLOB_NAME)
    
    schedule_blob = blob_client.download_blob()
    schedule = schedule_blob.readall()
    schedule = schedule.decode("utf-8").strip()
    
    return schedule

@app.route(route="set_schedule")
def set_schedule(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Received request to set schedule.')

    # 쿼리 파라미터에서 스케줄 값 가져오기
    schedule = req.params.get('schedule')
    
    # 요청 본문에서 스케줄 값 가져오기 (POST 요청 처리)
    if not schedule:
        try:
            req_body = req.get_json()
        except ValueError:
            pass
        else:
            schedule = req_body.get('schedule')

    # 스케줄 값이 없는 경우
    if not schedule:
        logging.error("No schedule provided in the reuqest.")
        return func.HttpResponse("Pleaase provide a 'schedule' parameter in the query string or request body.", status_code=400)
    
    user_id = req.params.get('user_id')
    if not user_id:
        user_id = "c0ff4b5b-3c2d-4335-a057-33e48c565f1e"
    
    # 스케줄 값 Blob Storage에 저장
    upload_schedule(user_id, schedule)
    
    return func.HttpResponse(f"Schedule successfully set to : {schedule}", status_code=200)

@app.route(route="set_message")
def set_message(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Received request to set schedule.')
    
    message = req.params.get('message')
    
    if not message:
        message = "안녕히 주무셨어요? 오늘 기분은 어떠신가요?"
    
    user_id = req.params.get('user_id')
    if not user_id:
        user_id = "c0ff4b5b-3c2d-4335-a057-33e48c565f1e"

    try:
        good_morning(user_id, message)
        return func.HttpResponse(f"Message successfully set to : {message}", status_code=200)
    except Exception as e:
        logging.error(e)
        return func.HttpResponse("Failed to set message : {}".format(e), status_code=400)

@app.route(route="get_audiofile")
def get_audiofile(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Download audio file from blob storage.')
    
    audiofile = req.params.get('audiofile')
    
    if not audiofile:
        audiofile = "good_morning.wav"
    
    if not audiofile:
        logging.error("No audiofile provided in the request.")
        return func.HttpResponse("Please provide a 'audiofile' parameter in the query string or request body.", status_code=400)
    
    user_id = req.params.get('user_id')
    if not user_id:
        user_id = "c0ff4b5b-3c2d-4335-a057-33e48c565f1e"
    
    try:
        logging.info("Audio file successfully downloaded from blob storage.")
        return func.HttpResponse(
            body = download_audiofile(user_id, audiofile),
            mimetype = "audio/wav",
            status_code=200
        )
    except Exception as e:
        logging.error(e)
        return func.HttpResponse("Failed to download audio file from blob storage. : {}".format(e), status_code=400)