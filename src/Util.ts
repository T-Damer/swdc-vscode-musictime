import {
  workspace,
  extensions,
  window,
  ViewColumn,
  Uri,
  commands,
  TextDocument,
  WorkspaceFolder,
} from "vscode";
import {
  CODE_TIME_EXT_ID,
  MUSIC_TIME_EXT_ID,
  launch_url,
  MUSIC_TIME_PLUGIN_ID,
  MUSIC_TIME_TYPE,
  SOFTWARE_TOP_40_PLAYLIST_ID,
  SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
} from "./Constants";
import { getToggleFileEventLoggingState } from "./DataController";
import { PlaylistItem, TrackStatus, CodyResponse, CodyResponseType } from "cody-music";
import * as path from "path";
import {
  getDeviceFile,
  getExtensionName,
  getSoftwareSessionFile,
} from "./managers/FileManager";
import { v4 as uuidv4 } from "uuid";

const fileIt = require("file-it");
const moment = require("moment-timezone");
const open = require("open");
const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

// const resourcePath: string = path.join(__filename, "..", "..", "resources");
const resourcePath: string = path.join(__dirname, "resources");

export const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const DASHBOARD_LABEL_WIDTH = 25;
export const DASHBOARD_VALUE_WIDTH = 25;
export const MARKER_WIDTH = 4;

const NUMBER_IN_EMAIL_REGEX = new RegExp("^\\d+\\+");
const dayFormat = "YYYY-MM-DD";
const dayTimeFormat = "LLLL";

// start off as focused as the editor may have
// had that file in the tabs. any close or tab
// switch will set this to false if the file isn't CodeTime
let editorSessiontoken = null;
let workspace_name = null;

export function getWorkspaceName() {
  if (!workspace_name) {
    workspace_name = randomCode();
  }
  return workspace_name;
}

export function getEditorSessionToken() {
  if (!editorSessiontoken) {
    editorSessiontoken = randomCode();
  }
  return editorSessiontoken;
}

/**
 * This will return a random whole number inclusively between the min and max
 * @param min
 * @param max
 */
export function getRandomArbitrary(min, max) {
  max = max + 0.1;
  return parseInt(Math.random() * (max - min) + min, 10);
}

export function getPluginId() {
  return MUSIC_TIME_PLUGIN_ID;
}

export function getPluginName() {
  return MUSIC_TIME_EXT_ID;
}

export function getPluginType() {
  return MUSIC_TIME_TYPE;
}

export function getVersion() {
  const extension = extensions.getExtension(MUSIC_TIME_EXT_ID);
  return extension.packageJSON.version;
}

export function isCodeTimeMetricsFile(fileName) {
  fileName = fileName || "";
  if (fileName.includes(".software") && fileName.includes("CodeTime")) {
    return true;
  }
  return false;
}

export function codeTimeExtInstalled() {
  const codeTimeExt = extensions.getExtension(CODE_TIME_EXT_ID);
  return codeTimeExt ? true : false;
}

export function musicTimeExtInstalled() {
  const musicTimeExt = extensions.getExtension(MUSIC_TIME_EXT_ID);
  return musicTimeExt ? true : false;
}

export function getSessionFileCreateTime() {
  let sessionFile = getSoftwareSessionFile();
  const stat = fs.statSync(sessionFile);
  if (stat.birthtime) {
    return stat.birthtime;
  }
  return stat.ctime;
}

export function isGitProject(projectDir) {
  if (!projectDir) {
    return false;
  }

  if (!fs.existsSync(path.join(projectDir, ".git"))) {
    return false;
  }
  return true;
}

/**
 * This method is sync, no need to await on it.
 * @param file
 */
export function getFileAgeInDays(file) {
  if (!fs.existsSync(file)) {
    return 0;
  }
  const stat = fs.statSync(file);
  let creationTimeSec = stat.birthtimeMs || stat.ctimeMs;
  // convert to seconds
  creationTimeSec /= 1000;

  const daysDiff = moment.duration(moment().diff(moment.unix(creationTimeSec))).asDays();

  // if days diff is 0 then use 200, otherwise 100 per day, which is equal to a 9000 limit for 90 days
  return daysDiff > 1 ? parseInt(daysDiff, 10) : 1;
}

/**
 * These will return the workspace folders.
 * use the uri.fsPath to get the full path
 * use the name to get the folder name
 */
export function getWorkspaceFolders(): WorkspaceFolder[] {
  let folders = [];
  if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
    for (let i = 0; i < workspace.workspaceFolders.length; i++) {
      let workspaceFolder = workspace.workspaceFolders[i];
      let folderUri = workspaceFolder.uri;
      if (folderUri && folderUri.fsPath) {
        folders.push(workspaceFolder);
      }
    }
  }
  return folders;
}

export function getActiveProjectWorkspace(): WorkspaceFolder {
  const activeDocPath = findFirstActiveDirectoryOrWorkspaceDirectory();
  if (activeDocPath) {
    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
      for (let i = 0; i < workspace.workspaceFolders.length; i++) {
        const workspaceFolder = workspace.workspaceFolders[i];
        const folderPath = workspaceFolder.uri.fsPath;
        if (activeDocPath.indexOf(folderPath) !== -1) {
          return workspaceFolder;
        }
      }
    }
  }
  return null;
}

export function isFileActive(file: string, isCloseEvent: boolean = false): boolean {
  if (isCloseEvent) return true;

  if (workspace.textDocuments) {
    for (let i = 0; i < workspace.textDocuments.length; i++) {
      const doc: TextDocument = workspace.textDocuments[i];
      if (doc && doc.fileName === file) {
        return true;
      }
    }
  }
  return false;
}

export function findFirstActiveDirectoryOrWorkspaceDirectory(): string {
  if (getNumberOfTextDocumentsOpen() > 0) {
    // check if the .software/CodeTime has already been opened
    for (let i = 0; i < workspace.textDocuments.length; i++) {
      let docObj = workspace.textDocuments[i];
      if (docObj.fileName) {
        const dir = getRootPathForFile(docObj.fileName);
        if (dir) {
          return dir;
        }
      }
    }
  }
  const folder: WorkspaceFolder = getFirstWorkspaceFolder();
  if (folder) {
    return folder.uri.fsPath;
  }
  return "";
}

export function getFirstWorkspaceFolder(): WorkspaceFolder {
  const workspaceFolders: WorkspaceFolder[] = getWorkspaceFolders();
  if (workspaceFolders && workspaceFolders.length) {
    return workspaceFolders[0];
  }
  return null;
}

export function getRootPaths() {
  let paths = [];
  if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
    for (let i = 0; i < workspace.workspaceFolders.length; i++) {
      let workspaceFolder = workspace.workspaceFolders[i];
      let folderUri = workspaceFolder.uri;
      if (folderUri && folderUri.fsPath) {
        paths.push(folderUri.fsPath);
      }
    }
  }
  return paths;
}

export function getNumberOfTextDocumentsOpen() {
  return workspace.textDocuments ? workspace.textDocuments.length : 0;
}

export function isFileOpen(fileName) {
  if (workspace.textDocuments) {
    for (let i = 0; i < workspace.textDocuments.length; i++) {
      const doc: TextDocument = workspace.textDocuments[i];
      if (doc && doc.fileName === fileName) {
        return true;
      }
    }
  }
  return false;
}

export function getRootPathForFile(fileName) {
  let folder = getProjectFolder(fileName);
  if (folder) {
    return folder.uri.fsPath;
  }
  return null;
}

export function getProjectFolder(fileName) {
  let liveshareFolder = null;
  if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
    for (let i = 0; i < workspace.workspaceFolders.length; i++) {
      let workspaceFolder = workspace.workspaceFolders[i];
      if (workspaceFolder.uri) {
        let isVslsScheme = workspaceFolder.uri.scheme === "vsls" ? true : false;
        if (isVslsScheme) {
          liveshareFolder = workspaceFolder;
        }
        let folderUri = workspaceFolder.uri;
        if (folderUri && folderUri.fsPath && !isVslsScheme && fileName.includes(folderUri.fsPath)) {
          return workspaceFolder;
        }
      }
    }
  }
  // wasn't found but if liveshareFolder was found, return that
  if (liveshareFolder) {
    return liveshareFolder;
  }
  return null;
}

export function validateEmail(email) {
  let re = /\S+@\S+\.\S+/;
  return re.test(email);
}

export function setItem(key, value) {
  fileIt.setJsonValue(getSoftwareSessionFile(), key, value);
}

export function getItem(key) {
  return fileIt.getJsonValue(getSoftwareSessionFile(), key);
}

export function getPluginUuid() {
  let plugin_uuid = fileIt.getJsonValue(getDeviceFile(), "plugin_uuid");
  if (!plugin_uuid) {
      // set it for the 1st and only time
      plugin_uuid = uuidv4();
      fileIt.setJsonValue(getDeviceFile(), "plugin_uuid", plugin_uuid);
  }
  return plugin_uuid;
}

export function getAuthCallbackState() {
  return fileIt.getJsonValue(getDeviceFile(), "auth_callback_state");
}

export function setAuthCallbackState(value: string) {
  fileIt.setJsonValue(getDeviceFile(), "auth_callback_state", value);
}

export function isEmptyObj(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

export function isLinux() {
  return isWindows() || isMac() ? false : true;
}

// process.platform return the following...
//   -> 'darwin', 'freebsd', 'linux', 'sunos' or 'win32'
export function isWindows() {
  return process.platform.indexOf("win32") !== -1;
}

export function isMac() {
  return process.platform.indexOf("darwin") !== -1;
}

export async function getHostname() {
  let hostname = await getCommandResult("hostname", 1);
  return hostname;
}

export function getOs() {
  let parts = [];
  let osType = os.type();
  if (osType) {
    parts.push(osType);
  }
  let osRelease = os.release();
  if (osRelease) {
    parts.push(osRelease);
  }
  let platform = os.platform();
  if (platform) {
    parts.push(platform);
  }
  if (parts.length > 0) {
    return parts.join("_");
  }
  return "";
}

export async function getCommandResult(cmd, maxLines: any = -1) {
  let result = await wrapExecPromise(`${cmd}`, null);
  if (!result) {
    return "";
  }
  let contentList = result.replace(/\r\n/g, "\r").replace(/\n/g, "\r").split(/\r/);
  if (contentList && contentList.length > 0) {
    let len = maxLines !== -1 ? Math.min(contentList.length, maxLines) : contentList.length;
    for (let i = 0; i < len; i++) {
      let line = contentList[i];
      if (line && line.trim().length > 0) {
        result = line.trim();
        break;
      }
    }
  }
  return result;
}

export async function getOsUsername() {
  let username = os.userInfo().username;
  if (!username || username.trim() === "") {
    username = await getCommandResult("whoami", 1);
  }
  return username;
}

export function softwareSessionFileExists() {
  // don't auto create the file
  const file = getSoftwareSessionFile();
  // check if it exists
  return fs.existsSync(file);
}

export function jwtExists() {
  let jwt = getItem("jwt");
  return !jwt ? false : true;
}

export function getLocalREADMEFile() {
  const resourcePath: string = path.join(__dirname, "resources");
  const file = path.join(resourcePath, "README.md");
  return file;
}

export function displayReadmeIfNotExists(override = false) {
  const displayedReadme = getItem("displayedMtReadme");
  if (!displayedReadme || override) {
    setTimeout(() => {
      commands.executeCommand("musictime.revealTree");
    }, 1000);

    const readmeUri = Uri.file(getLocalREADMEFile());

    commands.executeCommand("markdown.showPreview", readmeUri, ViewColumn.One);
    setItem("displayedMtReadme", true);
  }
}

export function logEvent(message) {
  const logEvents = getToggleFileEventLoggingState();
  if (logEvents) {
    console.log(`${getExtensionName()}: ${message}`);
  }
}

export function logIt(message) {
  console.log(`${getExtensionName()}: ${message}`);
}

export function getSoftwareSessionAsJson() {
  let data = fileIt.readJsonFileSync(getSoftwareSessionFile());
  return data ? data : {};
}

export async function showOfflinePrompt(addReconnectMsg = false) {
  // shows a prompt that we're not able to communicate with the app server
  let infoMsg = "Our service is temporarily unavailable. ";
  if (addReconnectMsg) {
    infoMsg +=
      "We will try to reconnect again in 10 minutes. Your status bar will not update at this time.";
  } else {
    infoMsg += "Please try again later.";
  }
  // set the last update time so we don't try to ask too frequently
  window.showInformationMessage(infoMsg, ...["OK"]);
}

export function nowInSecs() {
  return Math.round(Date.now() / 1000);
}

export function getOffsetSeconds() {
  let d = new Date();
  return d.getTimezoneOffset() * 60;
}

export function getNowTimes() {
  const now = moment.utc();
  const now_in_sec = now.unix();
  const offset_in_sec = moment().utcOffset() * 60;
  const local_now_in_sec = now_in_sec + offset_in_sec;
  const utcDay = now.format(dayFormat);
  const day = moment().format(dayFormat);
  const localDayTime = moment().format(dayTimeFormat);

  return {
    now,
    now_in_sec,
    offset_in_sec,
    local_now_in_sec,
    utcDay,
    day,
    localDayTime,
  };
}

export function getFormattedDay(unixSeconds) {
  return moment.unix(unixSeconds).format(dayFormat);
}

export function isNewDay() {
  const { day } = getNowTimes();
  const currentDay = getItem("currentDay");
  return currentDay !== day ? true : false;
}

export function coalesceNumber(val, defaultVal = 0) {
  if (val === null || val === undefined || isNaN(val)) {
    return defaultVal;
  }
  return val;
}

export function randomCode() {
  return crypto
    .randomBytes(16)
    .map((value) => alpha.charCodeAt(Math.floor((value * alpha.length) / 256)))
    .toString();
}

export function deleteFile(file) {
  // if the file exists, get it
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

/**
 * Format pathString if it is on Windows. Convert `c:\` like string to `C:\`
 * @param pathString
 */
export function formatPathIfNecessary(pathString: string) {
  if (process.platform === "win32") {
    pathString = pathString.replace(/^([a-zA-Z])\:\\/, (_, $1) => `${$1.toUpperCase()}:\\`);
  }
  return pathString;
}

function execPromise(command, opts) {
  return new Promise(function (resolve, reject) {
    exec(command, opts, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(stdout.trim());
    });
  });
}

export function normalizeGithubEmail(email: string, filterOutNonEmails = true) {
  if (email) {
    if (filterOutNonEmails && (email.endsWith("github.com") || email.includes("users.noreply"))) {
      return null;
    } else {
      const found = email.match(NUMBER_IN_EMAIL_REGEX);
      if (found && email.includes("users.noreply")) {
        // filter out the ones that look like
        // 2342353345+username@users.noreply.github.com"
        return null;
      }
    }
  }

  return email;
}

export function getSongDisplayName(name) {
  if (!name) {
    return "";
  }
  let displayName = "";
  name = name.trim();
  if (name.length > 14) {
    const parts = name.split(" ");
    for (let i = 0; i < parts.length; i++) {
      displayName = `${displayName} ${parts[i]}`;
      if (displayName.length >= 12) {
        if (displayName.length > 14) {
          // trim it down to at least 14
          displayName = `${displayName.substring(0, 14)}`;
        }
        displayName = `${displayName}..`;
        break;
      }
    }
  } else {
    displayName = name;
  }
  return displayName.trim();
}

export async function getGitEmail() {
  let projectDirs = getRootPaths();

  if (!projectDirs || projectDirs.length === 0) {
    return null;
  }

  for (let i = 0; i < projectDirs.length; i++) {
    let projectDir = projectDirs[i];

    let email = await wrapExecPromise("git config user.email", projectDir);
    if (email) {
      /**
       * // normalize the email, possible github email types
       * shupac@users.noreply.github.com
       * 37358488+rick-software@users.noreply.github.com
       */
      email = normalizeGithubEmail(email);
      return email;
    }
  }
  return null;
}

// replace all newlines, additional spaces, < or > chars with empty and split by the \r
// the < and > surround the github email address
export async function getCommandResultAsList(cmd, projectDir) {
  let result = await wrapExecPromise(cmd, projectDir);
  if (!result) {
    return [];
  }
  result = result.trim();
  // replace newlines with \r, remove the < and > around the email string and split by \n
  // to return an array of values
  const resultList = result
    .replace(/\r\n/g, "\r")
    .replace(/\n/g, "\r")
    .replace(/^\s+/g, " ")
    .replace(/</g, "")
    .replace(/>/g, "")
    .split(/\r/);
  return resultList;
}

export async function getCommandResultString(cmd, projectDir) {
  let result = await wrapExecPromise(cmd, projectDir);
  if (!result) {
    // something went wrong, but don't try to parse a null or undefined str
    return null;
  }
  result = result.trim();
  result = result.replace(/\r\n/g, "\r").replace(/\n/g, "\r").replace(/^\s+/g, " ");
  return result;
}

export async function wrapExecPromise(cmd, projectDir = null) {
  let result = null;
  try {
    let opts = projectDir !== undefined && projectDir !== null ? { cwd: projectDir } : {};
    result = await execPromise(cmd, opts).catch((e) => {
      if (e.message) {
        console.log("task error: ", e.message);
      }
      return null;
    });
  } catch (e) {
    if (e.message) {
      console.log("task error: ", e.message);
    }
    result = null;
  }
  return result;
}

export function countUniqueStrings(list: Array<string>) {
  return new Set(list).size;
}

export function launchWebUrl(url) {
  open(url);
}

export function launchMusicAnalytics() {
  open(`${launch_url}/music`);
}

/**
 * humanize the minutes
 */
export function humanizeMinutes(min) {
  min = parseInt(min, 0) || 0;
  let str = "";
  if (min === 60) {
    str = "1 hr";
  } else if (min > 60) {
    let hrs = parseFloat(min) / 60;
    if (hrs % 1 === 0) {
      str = hrs.toFixed(0) + " hrs";
    } else {
      str = (Math.round(hrs * 10) / 10).toFixed(1) + " hrs";
    }
  } else if (min === 1) {
    str = "1 min";
  } else {
    // less than 60 seconds
    str = min.toFixed(0) + " min";
  }
  return str;
}

export function showInformationMessage(message: string) {
  return window.showInformationMessage(`${message}`);
}

export function showWarningMessage(message: string) {
  return window.showWarningMessage(`${message}`);
}

export function getDashboardRow(label, value) {
  let content = `${getDashboardLabel(label)} : ${getDashboardValue(value)}\n`;
  return content;
}

export function getSectionHeader(label) {
  let content = `${label}\n`;
  // add 3 to account for the " : " between the columns
  let dashLen = DASHBOARD_LABEL_WIDTH + DASHBOARD_VALUE_WIDTH + 15;
  for (let i = 0; i < dashLen; i++) {
    content += "-";
  }
  content += "\n";
  return content;
}

export function buildQueryString(obj) {
  let params = [];
  if (obj) {
    let keys = Object.keys(obj);
    if (keys && keys.length > 0) {
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let val = obj[key];
        if (val && val !== undefined) {
          let encodedVal = encodeURIComponent(val);
          params.push(`${key}=${encodedVal}`);
        }
      }
    }
  }
  if (params.length > 0) {
    return "?" + params.join("&");
  } else {
    return "";
  }
}

function getDashboardLabel(label, width = DASHBOARD_LABEL_WIDTH) {
  return getDashboardDataDisplay(width, label);
}

function getDashboardValue(value) {
  let valueContent = getDashboardDataDisplay(DASHBOARD_VALUE_WIDTH, value);
  let paddedContent = "";
  for (let i = 0; i < 11; i++) {
    paddedContent += " ";
  }
  paddedContent += valueContent;
  return paddedContent;
}

function getDashboardDataDisplay(widthLen, data) {
  let len = data.constructor === String ? widthLen - data.length : widthLen - String(data).length;
  let content = "";
  for (let i = 0; i < len; i++) {
    content += " ";
  }
  return `${content}${data}`;
}

export function createUriFromTrackId(track_id: string) {
  if (track_id && !track_id.includes("spotify:track:")) {
    track_id = `spotify:track:${track_id}`;
  }

  return track_id;
}

export function createUriFromPlaylistId(playlist_id: string) {
  if (playlist_id && !playlist_id.includes("spotify:playlist:")) {
    playlist_id = `spotify:playlist:${playlist_id}`;
  }

  return playlist_id;
}

export function createSpotifyIdFromUri(id: string) {
  if (id && id.indexOf("spotify:") === 0) {
    return id.substring(id.lastIndexOf(":") + 1);
  }
  return id;
}

export function isValidJson(val: any) {
  if (val === null || val === undefined) {
    return false;
  }
  if (typeof val === "string" || typeof val === "number") {
    return false;
  }
  try {
    const stringifiedVal = JSON.stringify(val);
    JSON.parse(stringifiedVal);
    return true;
  } catch (e) {
    //
  }
  return false;
}

export function getFileType(fileName: string) {
  let fileType = "";
  const lastDotIdx = fileName.lastIndexOf(".");
  const len = fileName.length;
  if (lastDotIdx !== -1 && lastDotIdx < len - 1) {
    fileType = fileName.substring(lastDotIdx + 1);
  }
  return fileType;
}

export function getPlaylistIcon(treeItem: PlaylistItem) {
  const stateVal = treeItem.state !== TrackStatus.Playing ? "notplaying" : "playing";
  let contextValue = "";

  // itemType will be either: track | playlist
  // type will be either: connected | action | recommendation | label | track | playlist | itunes | spotify
  // tag will be either: action | paw | spotify | spotify-liked-songs | active

  // track/playlist/action hover contextValue matching...
  // musictime.sharePlaylist =~ /spotify-playlist-item.*/
  // musictime.shareTrack =~ /track-item.*/ || /spotify-recommendation.*/
  // musictime.addToPlaylist =~ /spotify-recommendation.*/
  // musictime.highPopularity =~ /.*-highpopularity/

  if (treeItem.tag === "action") {
    this.contextValue = "treeitem-action";
  } else if (treeItem["itemType"] === "track" || treeItem["itemType"] === "playlist") {
    if (treeItem.tag === "paw") {
      // we use the paw to show as the music time playlist, but
      // make sure the contextValue has spotify in it
      contextValue = `spotify-${treeItem.type}-item-${stateVal}`;
    } else {
      if (treeItem.tag) {
        contextValue = `${treeItem.tag}-${treeItem.type}-item-${stateVal}`;
      } else {
        contextValue = `${treeItem.type}-item-${stateVal}`;
      }
    }
  }

  if (treeItem.id === SOFTWARE_TOP_40_PLAYLIST_ID && !treeItem.loved) {
    contextValue += "-softwaretop40";
  } else if (treeItem["playlist_id"] == SPOTIFY_LIKED_SONGS_PLAYLIST_NAME) {
    contextValue += "-isliked";
  }

  let lightPath = null;
  let darkPath = null;

  if (treeItem["icon"]) {
    lightPath = path.join(resourcePath, "light", treeItem["icon"]);
    darkPath = path.join(resourcePath, "dark", treeItem["icon"]);
  } else if (
    treeItem.type.includes("spotify") ||
    (treeItem.tag.includes("spotify") && treeItem.itemType !== "playlist")
  ) {
    const spotifySvg =
      treeItem.tag === "disabled" ? "spotify-disconnected.svg" : "spotify-logo.svg";
    lightPath = path.join(resourcePath, "light", spotifySvg);
    darkPath = path.join(resourcePath, "dark", spotifySvg);
  } else if (treeItem.itemType === "playlist" && treeItem.tag !== "paw") {
    const playlistSvg = "playlist.svg";
    lightPath = path.join(resourcePath, "light", playlistSvg);
    darkPath = path.join(resourcePath, "dark", playlistSvg);
  } else if (treeItem.tag === "itunes" || treeItem.type === "itunes") {
    lightPath = path.join(resourcePath, "light", "itunes-logo.svg");
    darkPath = path.join(resourcePath, "dark", "itunes-logo.svg");
  } else if (treeItem.tag === "paw") {
    lightPath = path.join(resourcePath, "light", "paw.svg");
    darkPath = path.join(resourcePath, "dark", "paw.svg");
  } else if (treeItem.type === "connected") {
    lightPath = path.join(resourcePath, "light", "radio-tower.svg");
    darkPath = path.join(resourcePath, "dark", "radio-tower.svg");
  } else if (treeItem.type === "offline") {
    lightPath = path.join(resourcePath, "light", "nowifi.svg");
    darkPath = path.join(resourcePath, "dark", "nowifi.svg");
  } else if (treeItem.type === "action" || treeItem.tag === "action") {
    lightPath = path.join(resourcePath, "light", "gear.svg");
    darkPath = path.join(resourcePath, "dark", "gear.svg");
  } else if (treeItem.type === "login" || treeItem.tag === "login") {
    lightPath = path.join(resourcePath, "light", "sign-in.svg");
    darkPath = path.join(resourcePath, "dark", "sign-in.svg");
  } else if (treeItem.type === "divider") {
    lightPath = path.join(resourcePath, "light", "blue-line-96.png");
    darkPath = path.join(resourcePath, "dark", "blue-line-96.png");
  }
  return { lightPath, darkPath, contextValue };
}

export function getCodyErrorMessage(response: CodyResponse) {
  if (response && response.error && response.error.response) {
    return response.error.response.data.error.message;
  } else if (response.state === CodyResponseType.Failed) {
    return response.message;
  }
  return "";
}

export function isBatchSizeUnderThreshold(payloads) {
  const payloadDataLen = Buffer.byteLength(JSON.stringify(payloads));
  if (payloadDataLen <= 100000) {
    return true;
  }
  return false;
}

export function getFileDataArray(file) {
  let payloads: any[] = fileIt.readJsonArraySync(file);
  return payloads;
}

export function getFileDataPayloadsAsJson(file) {
  // Still trying to find out when "undefined" is set into the data.json
  // but this will help remove it so we can process the json lines without failure
  let content = fileIt.readContentFileSync(file);
  if (content.indexOf("undefined") !== -1) {
    // remove "undefined" and re-save, then read (only found in the beginning of the content)
    content = content.replace("undefined", "");
    fileIt.writeContentFileSync(file, content);
  }
  let payloads: any[] = fileIt.readJsonLinesSync(file);
  return payloads;
}
