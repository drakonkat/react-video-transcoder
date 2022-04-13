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
export const fileExists = (file, ffmpeg) => {
    let output = ffmpeg.FS("readdir", "/").includes(file)
    console.log("Checked " + file + ": ", output)
    return output
};

export const convertHMS = (value) => {
    const sec = parseInt(value, 10); // convert value to number if it's string
    let hours = Math.floor(sec / 3600); // get hours
    let minutes = Math.floor((sec - (hours * 3600)) / 60); // get minutes
    let seconds = sec - (hours * 3600) - (minutes * 60); //  get seconds
    // add 0 if value < 10; Example: 2 => 02
    if (hours < 10) {
        hours = "0" + hours;
    }
    if (minutes < 10) {
        minutes = "0" + minutes;
    }
    if (seconds < 10) {
        seconds = "0" + seconds;
    }
    return hours + ':' + minutes + ':' + seconds; // Return is HH : MM : SS
}
