import urllib.request
import json
import os

def main():
    openapi_url = "http://localhost:8000/api/v1/openapi.json"
    try:
        print("Fetching OpenAPI schema from", openapi_url)
        with urllib.request.urlopen(openapi_url) as response:
            openapi_data = json.loads(response.read().decode())
        
        # Save OpenAPI JSON to workspace root
        openapi_path = "../openapi.json"
        with open(openapi_path, "w") as f:
            json.dump(openapi_data, f, indent=2)
        print(f"Saved OpenAPI schema to {os.path.abspath(openapi_path)}")
    except Exception as e:
        print("Error fetching OpenAPI schema:", e)
        print("Make sure the backend server is running on http://localhost:8000")
        return

    # Build Postman Collection from OpenAPI schema
    try:
        title = openapi_data.get("info", {}).get("title", "Enterprise Multi-Agent RAG Platform")
        version = openapi_data.get("info", {}).get("version", "1.0.0")
        
        postman = {
            "info": {
                "_postman_id": "ee5d8a9e-2144-469a-b44c-1ad8b006a8f1",
                "name": f"{title} - Postman Collection",
                "description": f"Generated automatically from OpenAPI Spec v{version}",
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "item": []
        }
        
        # Group paths/endpoints by tag (e.g., auth, chats, workflows)
        folders = {}
        
        paths = openapi_data.get("paths", {})
        for path_url, path_data in paths.items():
            for method, method_data in path_data.items():
                if method.lower() not in ["get", "post", "put", "delete", "patch"]:
                    continue
                
                tags = method_data.get("tags", ["General"])
                tag = tags[0]
                
                query_params = []
                parameters = method_data.get("parameters", [])
                for param in parameters:
                    if param.get("in") == "query":
                        query_params.append({
                            "key": param.get("name"),
                            "value": "",
                            "description": param.get("description", ""),
                            "disabled": not param.get("required", False)
                        })
                
                request_item = {
                    "name": method_data.get("summary", f"{method.upper()} {path_url}"),
                    "request": {
                        "method": method.upper(),
                        "header": [
                            {
                                "key": "Content-Type",
                                "value": "application/json",
                                "type": "text"
                            },
                            {
                                "key": "Authorization",
                                "value": "Bearer {{access_token}}",
                                "type": "text",
                                "description": "JWT Authorization Token"
                            }
                        ],
                        "url": {
                            "raw": f"{{{{base_url}}}}{path_url}",
                            "host": ["{{base_url}}"],
                            "path": [p for p in path_url.strip("/").split("/") if p],
                            "query": query_params
                        },
                        "description": method_data.get("description", "")
                    },
                    "response": []
                }
                
                # Inject mock body templates for write methods
                if method.lower() in ["post", "put", "patch"]:
                    request_body = method_data.get("requestBody")
                    if request_body:
                        content = request_body.get("content", {})
                        if "application/json" in content:
                            # Standard JSON body
                            dummy_body = {}
                            request_item["request"]["body"] = {
                                "mode": "raw",
                                "raw": json.dumps(dummy_body, indent=2),
                                "options": {
                                    "raw": {
                                        "language": "json"
                                    }
                                }
                            }
                        elif "multipart/form-data" in content:
                            request_item["request"]["body"] = {
                                "mode": "formdata",
                                "formdata": []
                            }
                
                if tag not in folders:
                    folders[tag] = {
                        "name": tag,
                        "item": []
                    }
                folders[tag]["item"].append(request_item)
        
        postman["variable"] = [
            {
                "key": "base_url",
                "value": "http://localhost:8000",
                "type": "string"
            },
            {
                "key": "access_token",
                "value": "",
                "type": "string"
            }
        ]
        
        postman["item"] = list(folders.values())
        
        postman_path = "../postman_collection.json"
        with open(postman_path, "w") as f:
            json.dump(postman, f, indent=2)
        print(f"Saved Postman Collection to {os.path.abspath(postman_path)}")
        
    except Exception as e:
        print("Error generating Postman Collection:", e)

if __name__ == "__main__":
    main()
