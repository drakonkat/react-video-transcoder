import React, {Component} from 'react';
import {convertHMS, getDuration, load, readFile} from "../FFMpegUtils";
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
        parameter: "-s hd480 -crf 22 -c:a aac -b:a 160k -movflags frag_keyframe+empty_moov+default_base_moof -c:v libx264 -preset ultrafast",
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
        let {file, parameter} = this.state;
        this.setState({loading: true, progress: 0})
        try {
            console.log('Loading ffmpeg-core.js');
            await load(ffmpeg);
            let progress = 0;
            let myMediaSource = new MediaSource();
            this.videoElement.current.src = URL.createObjectURL(myMediaSource);
            let videoSourceBuffer;
            myMediaSource.addEventListener('sourceopen', async () => {
                this.setState({started: true})
                let mime = 'video/mp4; codecs="avc1.4D4028, mp4a.40.2"';
                videoSourceBuffer = myMediaSource.addSourceBuffer(mime);
                videoSourceBuffer.addEventListener('error', console.error);
                videoSourceBuffer.mode = "sequence";
                let iteration = 0;
                let durationChunk = 10;
                let error = true
                let durationFile;
                while (error) {
                    // I think can be optimized with less conversion
                    let outputFileName = file[0].name;
                    if (iteration === 0) {
                        let sourceBuffer = new Uint8Array(await readFile(file[0]))
                        console.log('Copy file', sourceBuffer, file[0]);
                        await ffmpeg.FS('writeFile', outputFileName, sourceBuffer);
                        durationFile = await getDuration(ffmpeg, outputFileName);
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
                    let endDuration = convertHMS(iteration + durationChunk);
                    try {
                        await ffmpeg.run('-i', outputFileName,
                            "-ss", startDuration, "-t", chunkDuration,
                            ...parameter.split(" "),
                            iteration + "_converted.mp4");
                    } catch (e) {
                        let sourceBuffer = new Uint8Array(await readFile(file[0]))
                        console.log('Copy file', sourceBuffer, file[0]);
                        await ffmpeg.FS('writeFile', outputFileName, sourceBuffer);
                        durationFile = await getDuration(ffmpeg, outputFileName);
                        myMediaSource.duration = durationFile;
                        error = true;
                        console.error("ERROR: ", e)
                        console.log("Iteration not increased")
                        continue;
                    }
                    console.log("Added piece: " + (startDuration) + " to " + (endDuration) + " on total " + convertHMS(durationFile))
                    let temp = ffmpeg.FS('readFile', iteration + "_converted.mp4");
                    videoSourceBuffer.appendBuffer(temp);
                    this.setState({loading: progress >= 1, progress})
                    iteration += durationChunk
                    if (iteration >= durationFile) {
                        error = false
                        setTimeout(()=> {
                            myMediaSource.endOfStream()

                        },2000);
                    } else if (iteration > (durationFile - durationChunk)) {
                        durationChunk = durationFile - iteration;
                    }
                }
            });
        } catch (e) {
            console.error("Transcoding error", e)
        }
    }

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
                                              this.setState({file: null, started: false, logs: []}, () => {
                                                  window.location.reload();
                                              })
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
                                {logs.map((l,index) => {
                                    return <Typography key={index+"logLine"} variant={"body2"} color={"fine"}>{l}</Typography>
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
