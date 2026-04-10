from app.api.auth_routes import (
    delete_user_route as delete_user,
    list_users_route as list_users,
    login_route as login,
    register_user_route as register_user,
)
from app.api.board_routes import (
    create_bug_post_route as create_bug_post,
    create_request_post_route as create_request_post,
    delete_bug_post_route as delete_bug_post,
    delete_request_post_route as delete_request_post,
    list_bug_posts_route as list_bug_posts,
    list_request_posts_route as list_request_posts,
    update_bug_post_route as update_bug_post,
    update_request_post_route as update_request_post,
)
from app.api.log_routes import (
    add_log_special_note_route as add_log_special_note,
    delete_log_route as delete_log,
    download_log_route as download_log,
    get_log_summary_route as get_log_summary,
    get_raw_log_route as get_raw_log,
    list_logs_route as list_logs,
    update_log_manual_fields_route as update_log_manual_fields,
    upload_logs_route as upload_logs,
)
from app.api.site_routes import (
    create_storage_site_route as create_storage_site,
    delete_storage_site_route as delete_storage_site,
    list_storage_sites_route as list_storage_sites,
    update_storage_site_route as update_storage_site,
)
from app.api.web_routes import api_root, health, root
from app.app_factory import create_app
from app.core.constants import SERVER_SESSION_ID
from app.core.lifecycle import on_startup
from app.db import get_db
from app.models import BugPost, RequestPost, StorageSite, UploadedLog, User
from app.schemas.payloads import (
    BugPostPayload,
    DeleteUserPayload,
    LoginPayload,
    ManualFieldsPayload,
    RegisterPayload,
    RequestPostPayload,
    SpecialNotePayload,
    StorageSitePayload,
)
from app.services.log_service import upload_log


app = create_app()

