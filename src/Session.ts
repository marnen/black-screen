import {readFileSync, writeFile} from "fs";
import * as _ from "lodash";
import Job from "./Job";
import History from "./History";
import Utils from "./Utils";
import Serializer from "./Serializer";
import EmitterWithUniqueID from "./EmitterWithUniqueID";
import PluginManager from "./PluginManager";
import {Status} from "./Enums";
import ApplicationComponent from "./views/1_ApplicationComponent";
const remote = require("remote");
const app = remote.require("app");
const browserWindow: typeof Electron.BrowserWindow = remote.require("electron").BrowserWindow;

export default class Session extends EmitterWithUniqueID {
    jobs: Array<Job> = [];
    history: typeof History;
    public historicalCurrentDirectoriesStack: string[] = [];
    private _currentDirectory: string;
    private stateFileName = `${Utils.homeDirectory}/.black-screen-state`;
    // The value of the dictionary is the default value used if there is no serialized data.
    private serializableProperties: Dictionary<any> = {
        currentDirectory: `String:${Utils.homeDirectory}`,
        history: `History:[]`,
    };

    constructor(private application: ApplicationComponent, private _dimensions: Dimensions) {
        super();

        // TODO: We want to deserialize properties only for the first instance
        // TODO: of Session for the application.
        this.deserialize();
        this.history = History;

        this.on("job", this.serialize.bind(this));

        this.clearJobs();
    }

    createJob(): void {
        const job = new Job(this);

        job.once("end", () => {
            if (app.dock && !browserWindow.getAllWindows().some(window => window.isFocused())) {
                app.dock.bounce("informational");
                const smiley = job.status === Status.Success ? "1" : "✕";
                app.dock.setBadge(smiley);
            }
            this.createJob();
        });

        this.jobs = this.jobs.concat(job);
        this.emit("job");
    }

    get dimensions(): Dimensions {
        return this._dimensions;
    }

    set dimensions(value: Dimensions) {
        this._dimensions = value;
        this.jobs.forEach(job => job.winch());
    }

    clearJobs(): void {
        this.jobs = [];
        this.createJob();
    }

    remove(): void {
        this.application.removeSession(this);
    }

    get currentDirectory(): string {
        return this._currentDirectory;
    }

    set currentDirectory(value: string) {
        let normalizedDirectory =  Utils.normalizeDir(value);
        if (normalizedDirectory === this._currentDirectory) {
            return;
        }

        PluginManager.environmentObservers.forEach(observer =>
            observer.currentWorkingDirectoryWillChange(this, normalizedDirectory)
        );

        this._currentDirectory = normalizedDirectory;
        this.historicalCurrentDirectoriesStack.push(this._currentDirectory);

        PluginManager.environmentObservers.forEach(observer =>
            observer.currentWorkingDirectoryDidChange(this, normalizedDirectory)
        );
    }

    private serialize(): void {
        let values: Dictionary<string> = {};

        _.each(this.serializableProperties, (value: string, key: string) =>
            values[key] = Serializer.serialize((<any>this)[key])
        );

        writeFile(this.stateFileName, JSON.stringify(values), (error: any) => {
            if (error) throw error;
        });
    }

    private deserialize(): void {
        _.each(this.readSerialized(), (value: string, key: string) => {
            const setterName = `set${_.capitalize(key)}`;
            const that = (<any>this);
            const deserializedValue = Serializer.deserialize(value);

            if (that[setterName]) {
                that[setterName](deserializedValue);
            } else {
                that[key] = deserializedValue;
            }
        });
    }

    private readSerialized(): Dictionary<any> {
        try {
            return JSON.parse(readFileSync(this.stateFileName).toString());
        } catch (error) {
            return this.serializableProperties;
        }
    };
}
