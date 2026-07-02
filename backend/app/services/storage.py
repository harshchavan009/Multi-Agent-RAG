import os
import boto3
from botocore.client import Config
from typing import Optional
from app.core.config import settings

class StorageService:
    def upload_file(self, file_name: str, file_content: bytes, mime_type: str) -> str:
        raise NotImplementedError

    def download_file(self, file_path: str) -> bytes:
        raise NotImplementedError

    def delete_file(self, file_path: str) -> None:
        raise NotImplementedError

class LocalStorageService(StorageService):
    def __init__(self, upload_dir: str = "/Users/harsh/Desktop/Multi agent rag/uploads"):
        self.upload_dir = upload_dir
        os.makedirs(self.upload_dir, exist_ok=True)

    def upload_file(self, file_name: str, file_content: bytes, mime_type: str) -> str:
        file_path = os.path.join(self.upload_dir, file_name)
        with open(file_path, "wb") as f:
            f.write(file_content)
        return file_path

    def download_file(self, file_path: str) -> bytes:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        with open(file_path, "rb") as f:
            return f.read()

    def delete_file(self, file_path: str) -> None:
        if os.path.exists(file_path):
            os.remove(file_path)

class S3StorageService(StorageService):
    def __init__(self):
        self.bucket_name = settings.S3_BUCKET_NAME
        s3_args = {
            "region_name": settings.S3_REGION_NAME
        }
        if settings.S3_ACCESS_KEY and settings.S3_SECRET_KEY:
            s3_args["aws_access_key_id"] = settings.S3_ACCESS_KEY
            s3_args["aws_secret_access_key"] = settings.S3_SECRET_KEY
        if settings.S3_ENDPOINT_URL:
            s3_args["endpoint_url"] = settings.S3_ENDPOINT_URL
            s3_args["config"] = Config(signature_version="s3v4", s3={'addressing_style': 'path'})

        self.s3_client = boto3.client("s3", **s3_args)
        
        # Ensure bucket exists
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except Exception:
            try:
                if settings.S3_REGION_NAME == "us-east-1":
                    self.s3_client.create_bucket(Bucket=self.bucket_name)
                else:
                    self.s3_client.create_bucket(
                        Bucket=self.bucket_name,
                        CreateBucketConfiguration={"LocationConstraint": settings.S3_REGION_NAME}
                    )
                print(f"[S3 Storage] Created bucket '{self.bucket_name}' successfully.")
            except Exception as e:
                print(f"[S3 Storage] Failed to ensure bucket '{self.bucket_name}' exists: {e}")

    def upload_file(self, file_name: str, file_content: bytes, mime_type: str) -> str:
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=file_name,
                Body=file_content,
                ContentType=mime_type
            )
            # return s3 key as the path
            return file_name
        except Exception as e:
            print(f"[S3 Storage Upload Error] {e}")
            raise e

    def download_file(self, file_path: str) -> bytes:
        try:
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=file_path)
            return response["Body"].read()
        except Exception as e:
            print(f"[S3 Storage Download Error] {e}")
            raise e

    def delete_file(self, file_path: str) -> None:
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=file_path)
        except Exception as e:
            print(f"[S3 Storage Delete Error] {e}")

def get_storage_service() -> StorageService:
    if settings.STORAGE_PROVIDER == "s3" and settings.S3_ACCESS_KEY:
        try:
            return S3StorageService()
        except Exception as e:
            print(f"[Storage] S3 initialization failed: {e}. Falling back to LocalStorageService.")
            return LocalStorageService()
    return LocalStorageService()

storage_service = get_storage_service()
