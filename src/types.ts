export interface Board {
    board: string;
    title: string;
    ws_board: number;
    per_page: number;
    pages: number;
    max_filesize: number;
    max_webm_filesize: number;
    max_comment_chars: number;
    max_webm_duration: number;
    bump_limit: number;
    image_limit: number;
    cooldowns: any;
    meta_description: string;
    is_archived?: number;
    spoilers?: number;
    custom_spoilers?: number;
}

export interface Thread {
    no: number; // Post number
    now: string;
    name: string;
    sub?: string;
    com?: string; // Comment
    filename?: string;
    ext?: string; // .jpg, .png, .webm
    w?: number;
    h?: number;
    tn_w?: number;
    tn_h?: number;
    tim?: number; // Renamed filename
    time: number;
    md5?: string;
    fsize?: number;
    resto: number; // 0 for OP, otherwise thread ID
    capcode?: string;
    semantic_url?: string;
    replies?: number;
    images?: number;
    unique_ips?: number;
}

export interface ThreadPost extends Thread {
    board: string;
    opThread?: ThreadPost;
}

export interface CachedRequest {
    url: string;
    data: string; // JSON string
    timestamp: number;
}

export interface UserAction {
    id?: number;
    thread_id: string;
    board: string;
    timestamp: number;
    data?: string; // JSON string of the thread/post
}

export interface AppConfig {
    password?: string;
    selected_boards?: string[]; // JSON stringified
}
