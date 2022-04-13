import React, {Component} from 'react';
import {convertHMS, getDuration, getExtension, load, readFile} from "../FFMpegUtils";
import logo from "../asset/default-noborder.svg"
import {
    Button,
    Chip,
    Container,
    createTheme,
    CssBaseline,
    Stack,
    TextField,
    ThemeProvider,
    Typography
} from "@mui/material";

import {FileUploadOutlined, PlayCircleOutlined} from "@mui/icons-material";
import moment from "moment";

const round = (input) => {
    return Math.round(input * 100) / 100
}
const defaultTheme = createTheme();
const options = {
    typography: {
        fontSize: 12,
    },
    palette: {
        mode: 'dark',
        background: {
            default: "#303030",
            paper: "#121212"
        }
    },
    components: {
        MuiLinearProgress: {
            styleOverrides: {
                root: {
                    borderRadius: "10px"
                }
            }
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: "20px",
                    paddingLeft: "10px",
                    paddingRight: "10px",
                }
            }
        },
        MuiContainer: {
            styleOverrides: {
                root: {
                    paddingLeft: "0px",
                    paddingRight: "0px",
                    height: "100%",
                    [defaultTheme.breakpoints.up('xs')]: {
                        paddingLeft: "0px",
                        paddingRight: "0px",
                        paddingTop: "5px",
                    }
                },
            },
        },
    },
};

class VideoTranscoder extends Component {
    state = {
        logs: [],
        parameter: "-movflags frag_keyframe+empty_moov+default_base_moof -c:v libx264 -preset ultrafast",
        started: false,
        loading: false,
        ffmpegReady: false,
        theme: createTheme(options),
    }

    constructor() {
        super();
        this.videoElement = React.createRef();
    }

    log = (text, ...variable) => {
        // console.log(text, variable)
        this.setState((p) => {
            p.logs.push(text)
            return p;
        })
    }

    componentDidMount() {
        let {ffmpeg} = this.props;
        load(ffmpeg).then(
            () => {
                this.setState({
                    ffmpegReady: true
                })
            }
        )
    }

    transcode = async () => {
        let {ffmpeg} = this.props;
        let {file, loading, parameter} = this.state;
        this.setState({loading: true, progress: 0})
        try {
            console.log('Loading ffmpeg-core.js');
            await load(ffmpeg);
            let extension = getExtension(file[0].name);
            let fileSize = file[0].size
            let chunkSize = 102400;
            let progress = 0;
            // Create media source
            let myMediaSource = new MediaSource();
            this.videoElement.current.src = URL.createObjectURL(myMediaSource);
            // let duration = await getDuration(ffmpeg, outputFileName)
            // console.log("Duration of file: ", duration)
            let videoSourceBuffer;
            myMediaSource.addEventListener('sourceopen', async () => {
                this.setState({started: true})
                let mime = 'video/mp4; codecs="avc1.4D4028, mp4a.40.2"';
                videoSourceBuffer = myMediaSource.addSourceBuffer(mime);
                videoSourceBuffer.addEventListener('error', console.error);
                videoSourceBuffer.mode = "sequence";
                let fragments = [];
                let iteration = 0;
                let durationChunk = 10;
                let error = true
                let durationFile;
                while (error) {
                    // I think can be optimized with less conversion
                    let outputFileName = file[0].name;
                    if (iteration == 0) {
                        let sourceBuffer = new Uint8Array(await readFile(file[0]))
                        console.log('Copy file', sourceBuffer, file[0]);
                        await ffmpeg.FS('writeFile', outputFileName, sourceBuffer);
                        durationFile= await getDuration(ffmpeg, outputFileName);
                        myMediaSource.duration = durationFile;
                    }
                    console.log('Start transcoding ' + iteration);
                    ffmpeg.setLogger(({type, message}) => {
                        this.log(type + ": " + message);
                        /*
                         * type can be one of following:
                         *
                         * info: internal workflow debug messages
                         * fferr: ffmpeg native stderr output
                         * ffout: ffmpeg native stdout output
                         */
                    });
                    let startDuration = convertHMS(iteration);
                    let chunkDuration = convertHMS(durationChunk);
                    let endDuration = convertHMS(iteration+durationChunk);
                    try {
                        await ffmpeg.run('-i', outputFileName,
                            "-ss", startDuration, "-t", chunkDuration,
                            ...parameter.split(" "),
                            iteration + "_converted.mp4");
                    } catch (e) {
                        //TODO Controllo cambio file
                        let sourceBuffer = new Uint8Array(await readFile(file[0]))
                        console.log('Copy file', sourceBuffer, file[0]);
                        await ffmpeg.FS('writeFile', outputFileName, sourceBuffer);
                        durationFile= await getDuration(ffmpeg, outputFileName);
                        myMediaSource.duration = durationFile;
                        error = true;
                        console.error("ERROR: ", e)
                        console.log("Iteration not increased")
                        continue;
                    }
                    console.log("Added piece: " + (startDuration) + " to " + (endDuration) + " on total " + "??")
                    let temp = ffmpeg.FS('readFile', iteration + "_converted.mp4");
                    videoSourceBuffer.appendBuffer(temp);
                    this.setState({loading: progress >= 1, progress})
                    iteration +=durationChunk
                    if (iteration >= durationFile) {
                        error = false
                    }else if(iteration > (durationFile-durationChunk)){
                        durationChunk = durationFile-iteration;
                    }
                }


                // for (let offset = 0; offset < fileSize; offset += chunkSize) {
                //     // I think can be optimized with less conversion
                //     let blob = new File([file[0].slice(offset, offset + Math.min(chunkSize + 1, fileSize - offset), file[0].type)], offset + ".avi")
                //     let sourceBuffer = new Uint8Array(await readFile(blob))
                //     let outputFileName = offset + "." + extension;
                //     console.log('Copy file', sourceBuffer, blob);
                //     await ffmpeg.FS('writeFile', outputFileName, sourceBuffer);
                //     console.log('Start transcoding ' + iteration);
                //     ffmpeg.setLogger(({type, message}) => {
                //         this.log(type + ": " + message);
                //         /*
                //          * type can be one of following:
                //          *
                //          * info: internal workflow debug messages
                //          * fferr: ffmpeg native stderr output
                //          * ffout: ffmpeg native stdout output
                //          */
                //     });
                //     await ffmpeg.run('-i', outputFileName,
                //         ...parameter.split(" "),
                //         "-ss", "00:00:03", "-t", "00:00:08",
                //         offset + "_converted.mp4");
                //     console.log("Added piece: " + offset + " to " + (offset + Math.min(chunkSize + 1, fileSize - offset)) + " on total " + fileSize)
                //     let temp = ffmpeg.FS('readFile', offset + "_converted.mp4");
                //     fragments.push(offset + "_converted.mp4");
                //     videoSourceBuffer.appendBuffer(temp);
                //
                //     progress = round(((offset + Math.min(chunkSize + 1, fileSize - offset)) * 100) / fileSize);
                //     this.setState({loading: progress >= 1, progress})
                //     // if ((offset + chunkSize) >= fileSize) {
                //     //     this.videoElement.current.src = URL.createObjectURL(
                //     //         new Blob(fragments.map((n => {
                //     //             return ffmpeg.FS('readFile', n).buffer
                //     //         })), {type: "video/mp4"})
                //     //     );
                //     // }
                //     iteration++
                // }
            });
        } catch (e) {
            console.error("Transcoding error", e)
        }
    }

    // transcode = async () => {
    //     let {ffmpeg} = this.props;
    //     let {file, loading, parameter} = this.state;
    //     this.setState({loading: true, progress: 0})
    //     try {
    //         let extension = getExtension(file[0].name);
    //         let outputFileName = "test." + extension;
    //         let sourceBuffer = new Uint8Array(await readFile(file[0]))
    //         console.log('Loading ffmpeg-core.js');
    //         await load(ffmpeg);
    //         console.log('Copy file: ', outputFileName, sourceBuffer);
    //         await ffmpeg.FS('writeFile', outputFileName, sourceBuffer);
    //         console.log('Start transcoding');
    //         let duration = await getDuration(ffmpeg, outputFileName)
    //         console.log("Duration of file: ", duration)
    //         let progress = 0;
    //         ffmpeg.setProgress(({ratio}) => {
    //             progress = ratio;
    //             if (progress >= 1 && loading) {
    //                 this.setState({loading: false, progress: round(ratio * 100)})
    //             } else {
    //                 this.setState({progress: round(ratio * 100)})
    //             }
    //             /*
    //              * ratio is a float number between 0 and 1.
    //              */
    //         });
    //         ffmpeg.setLogger(({type, message}) => {
    //             this.log(type + ": " + message);
    //             /*
    //              * type can be one of following:
    //              *
    //              * info: internal workflow debug messages
    //              * fferr: ffmpeg native stderr output
    //              * ffout: ffmpeg native stdout output
    //              */
    //         });
    //         ffmpeg.run('-i', outputFileName,
    //             // Encode for MediaStream
    //             // "-segment_format_options", "movflags=frag_keyframe+empty_moov+default_base_moof",
    //             ...parameter.split(" "),
    //             // 120fps
    //             // "-filter:v", "tblend", "-r", "120",
    //             // Upscaling 4k
    //             // "-vf", "scale=3840:2160:flags=neighbor", "-r", "60",
    //             // Fast converting
    //             // "-c:v", "libx264", "-preset", "ultrafast",
    //             // Encode 2 second segments
    //             "-segment_time", "2",
    //             // Write to files by index
    //             "-f", "segment", "%d.mp4", "output.mp4");
    //
    //         // Create media source
    //         let myMediaSource = new MediaSource();
    //         this.videoElement.current.src = URL.createObjectURL(myMediaSource);
    //         myMediaSource.addEventListener('sourceopen', () => {
    //             this.setState({started: true})
    //             let index = 0;
    //             let videoSourceBuffer;
    //             this.playInterval = setInterval(() => {
    //                 if (index === 0 && fileExists("1.mp4", ffmpeg)) {
    //                     this.log("Added first pieces")
    //                     let mime = `video/mp4; codecs="avc1.42E01E, mp4a.40.2"`;
    //                     videoSourceBuffer = myMediaSource.addSourceBuffer(mime);
    //                     videoSourceBuffer.addEventListener('error', console.log);
    //                     myMediaSource.duration = duration;
    //                     videoSourceBuffer.mode = "sequence";
    //                     videoSourceBuffer.appendBuffer(ffmpeg.FS('readFile', '0.mp4'));
    //                     index++;
    //                 } else if (index > 0 && fileExists((index + 1) + ".mp4", ffmpeg)) {
    //                     this.log("Added pieces " + index)
    //                     videoSourceBuffer.appendBuffer(ffmpeg.FS('readFile', index + '.mp4'));
    //                     index++
    //                 } else if (index > 0 && progress >= 1) {
    //                     this.log("Close adding " + fileExists("output.mp4", ffmpeg))
    //                     this.videoElement.current.src = URL.createObjectURL(
    //                         new Blob([(ffmpeg.FS('readFile', 'output.mp4')).buffer], { type: "video/mp4" })
    //                     );
    //
    //                     clearInterval(this.playInterval)
    //                 }
    //             }, 1000)
    //         });
    //     } catch (e) {
    //         console.error("Transcoding error", e)
    //     }
    // }

    render() {
        let {
            loading,
            theme,
            file,
            progress,
            started,
            logs,
            parameter
        } = this.state;
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline/>
                <Container maxWidth="false">
                    <Stack key={"FIRST-ELEMENT"} justifyContent={"center"} spacing={2}>
                        <Stack
                            key={"SECOND-ELEMENT"}
                            sx={{
                                width: "100%",
                                backgroundColor: "background.paper",
                                [defaultTheme.breakpoints.down('md')]: {
                                    display: "none",
                                },
                                padding: "10px"
                            }}
                            spacing={2}
                            direction={"row"}
                            alignItems={"center"}
                            justifyContent={"center"}>
                            {/*<PlayCircleOutlined sx={{fontSize: 70}} color={"primary"}/>*/}
                            {/*<Typography variant={"h1"} color={"primary"}>JSTranscoder</Typography>*/}
                            <img style={{height: "100px"}} src={logo} alt="Logo"/>
                        </Stack>
                        <Stack key={"THIRD-ELEMENT"} alignItems={"center"} spacing={2}>

                            <Typography variant={"h4"}>Select a file to convert</Typography>
                            {file ? <Chip label={file[0].name} variant="outlined"
                                          onDelete={() => {
                                              this.setState({file: null, started: false, logs: []})
                                          }}
                                />
                                :
                                <Button variant="contained"
                                        startIcon={<FileUploadOutlined/>}
                                        component="label"
                                >
                                    Upload
                                    <input
                                        type="file"
                                        hidden
                                        multiple={false}
                                        accept={["video/mp4", "video/x-m4v", "video/*"]}
                                        onChange={(e) => {
                                            this.setState({
                                                file: e.target.files
                                            })
                                        }}
                                    />
                                </Button>
                            }
                            <Typography variant={"h6"}>Parameters:</Typography>
                            <TextField
                                fullWidth
                                id="parameter"
                                label="Parameters"
                                variant="filled"
                                value={parameter}
                                onChange={(e) => {
                                    let value = e.target.value;
                                    this.setState({
                                        parameter: value
                                    })
                                }}
                            />

                            <Button
                                disabled={file == null}
                                color={"primary"}
                                variant={"contained"}
                                endIcon={<PlayCircleOutlined/>}
                                onClick={this.transcode}
                            >
                                Transcode {loading && progress && "" + progress + "%"}
                            </Button>

                            <Stack sx={{display: started ? undefined : "none", maxWidth: "100%"}}>
                                <video ref={this.videoElement} controls onError={(e) => {
                                    console.error("Error: " + e.target.error.message + " CODE: " + e.target.error.code);
                                }}/>
                            </Stack>

                            <Stack sx={{
                                display: logs.length > 0 ? undefined : "none",
                                maxHeight: "200px",
                                overflow: "auto",
                                maxWidth: "50%",
                                padding: "10px"
                            }}>
                                <Typography variant={"h5"} color={"fine"}>Log of the operation:</Typography>
                                {logs.map((l) => {
                                    return <Typography variant={"body2"} color={"fine"}>{l}</Typography>
                                })}
                            </Stack>
                        </Stack>
                    </Stack>
                </Container>
            </ThemeProvider>
        );
    }

}

export default VideoTranscoder;
