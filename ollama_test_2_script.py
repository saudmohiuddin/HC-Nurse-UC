import requests

url = "http://localhost:5080/generate"
data = {
    "prompt": "What is the capital of France?"
}

response = requests.post(url, json=data)
print(response.json())