export interface SyncOptions {
    localesDir?: string;
    sourceDir?: string;
    baseLang?: string;
}
export declare class CLIService {
    sync(options?: SyncOptions): Promise<void>;
    translate(options?: SyncOptions): Promise<void>;
}
export declare const cliService: CLIService;
//# sourceMappingURL=cli.service.d.ts.map