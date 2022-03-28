import moment from "moment";

export const load = async (ffmpeg) => {
    if (!ffmpeg.isLoaded()) {
        await ffmpeg.load();
    }
}
export const getDuration = async (ffmpeg, name) => {
    let output;
    ffmpeg.setLogger(({type, message}) => {
        if (type === "fferr" && message.includes("Duration:")) {
            let duration = message.substring(message.indexOf("Duration:") + 9, message.indexOf("Duration:") + 21)
            let momentDuration = moment.duration(duration).asSeconds()
            output = momentDuration
        }
        /*
         * type can be one of following:
         *
         * info: internal workflow debug messages
         * fferr: ffmpeg native stderr output
         * ffout: ffmpeg native stdout output
         */
    });
    await ffmpeg.run('-i', name);
    return output;
}
export const readFile = (file) => {
    return new Promise((resolve, reject) => {
        // Create file reader
        let reader = new FileReader()

        // Register event listeners
        reader.addEventListener("loadend", e => resolve(e.target.result))
        reader.addEventListener("error", reject)

        // Read file
        reader.readAsArrayBuffer(file)
    })
}

export const getExtension = (name) => {
    return name.split('.').pop();
}
export const fileExists = (file, ffmpeg) => ffmpeg.FS("readdir", "/").includes(file);
