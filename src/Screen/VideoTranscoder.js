import React, {Component} from 'react';
import {fileExists, getDuration, getExtension, load, readFile} from "../FFMpegUtils";
import logo from "../asset/default-noborder.svg"
import {Button, Chip, Container, createTheme, CssBaseline, Stack, ThemeProvider, Typography} from "@mui/material";

import {FileUploadOutlined, PlayCircleOutlined} from "@mui/icons-material";

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
        started: false,
        loading: false,
        ffmpegReady: false,
        theme: createTheme(options),
    }

    constructor() {
        super();
        this.videoElement = React.createRef();
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
        let {file, loading} = this.state;
        this.setState({loading: true, progress: 0})
        try {
            let extension = getExtension(file[0].name);
            let outputFileName = "test." + extension;
            let sourceBuffer = new Uint8Array(await readFile(file[0]))
            console.log('Loading ffmpeg-core.js');
            await load(ffmpeg);
            console.log('Copy file: ', outputFileName, sourceBuffer);
            await ffmpeg.FS('writeFile', outputFileName, sourceBuffer);
            console.log('Start transcoding');
            let duration = await getDuration(ffmpeg, outputFileName)
            console.log("Duration of file: ", duration)
            let progress = 0;
            ffmpeg.setProgress(({ratio}) => {
                progress = ratio;
                if (progress >= 1 && loading) {
                    this.setState({loading: false, progress: round(ratio * 100)})
                } else {
                    this.setState({progress: round(ratio * 100)})
                }
                /*
                 * ratio is a float number between 0 and 1.
                 */
            });
            ffmpeg.run('-i', outputFileName,
                // Encode for MediaStream
                "-segment_format_options", "movflags=frag_keyframe+empty_moov+default_base_moof",
                // Encode 5 second segments
                "-c:v", "libx264", "-preset", "ultrafast",
                "-segment_time", "2",
                // Write to files by index
                "-f", "segment", "%d.mp4");

            // Create media source
            let myMediaSource = new MediaSource();
            this.videoElement.current.src = URL.createObjectURL(myMediaSource);
            myMediaSource.addEventListener('sourceopen', () => {
                this.setState({started: true})
                let index = 0;
                let videoSourceBuffer;
                this.playInterval = setInterval(() => {
                    if (index === 0 && fileExists("0.mp4", ffmpeg)) {
                        let mime = `video/mp4; codecs="avc1.42E01E, mp4a.40.2"`;
                        videoSourceBuffer = myMediaSource.addSourceBuffer(mime);
                        videoSourceBuffer.addEventListener('error', console.log);
                        myMediaSource.duration = duration;
                        videoSourceBuffer.mode = "sequence";
                        videoSourceBuffer.appendBuffer(ffmpeg.FS('readFile', '0.mp4'));
                        index++;
                    } else if (index > 0 && fileExists(index + ".mp4", ffmpeg)) {
                        videoSourceBuffer.appendBuffer(ffmpeg.FS('readFile', index + '.mp4'));
                        index++
                    } else if (index > 0 && progress >= 1) {
                        clearInterval(this.playInterval)
                    }
                }, 1000)
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
            started
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
                                              this.setState({files: null, started: false})
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
                                <video ref={this.videoElement} controls/>
                            </Stack>
                        </Stack>
                    </Stack>
                </Container>
            </ThemeProvider>
        );
    }

}

export default VideoTranscoder;
