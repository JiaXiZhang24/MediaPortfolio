export const BASE_PATH = "/videography-alt-2";

// Ring order. The same order drives the atlas, metadata and project index.
export const PROJECTS = [
  {
    file: "../assets/videography/surveillance/poster.jpg",
    name: "Surveillance",
    type: "Fictional short film",
    year: "01:07",
    video: "../assets/videography/surveillance/video.mp4",
    stills: [
      "../assets/videography/surveillance/poster.jpg",
      "../assets/videography/surveillance/still-01.jpg",
      "../assets/videography/surveillance/still-02.jpg",
      "../assets/videography/surveillance/still-03.jpg",
    ],
  },
  {
    file: "../assets/videography/bad-film/cover.jpg",
    name: "Bad Film",
    type: "Fiction / Music video",
    year: "01:42",
    video: "../assets/videography/bad-film/video.mp4",
    stills: [
      "../assets/videography/bad-film/still-01.jpg",
      "../assets/videography/bad-film/still-02.jpg",
      "../assets/videography/bad-film/still-03.jpg",
      "../assets/videography/bad-film/still-04.jpg",
    ],
  },
  {
    file: "../assets/videography/white-christmas/cover.jpg",
    name: "White Christmas",
    type: "Archive fable",
    year: "03:02",
    video: "../assets/videography/white-christmas/video.mp4",
    stills: [],
  },
  {
    file: "../assets/videography/roaming/cover.jpg",
    name: "Roaming",
    type: "Experimental Super-8 film",
    year: "02:41",
    video: "../assets/videography/roaming/video.mp4",
    stills: [
      "../assets/videography/roaming/still-01.jpg",
      "../assets/videography/roaming/still-02.jpg",
      "../assets/videography/roaming/still-03.jpeg",
      "../assets/videography/roaming/still-04.jpg",
    ],
  },
  {
    file: "../assets/videography/kinoeyes/cover.jpg",
    name: "Kinoeyes",
    type: "Experimental short film",
    year: "02:02",
    video: "../assets/videography/kinoeyes/video.mp4",
    stills: [
      "../assets/videography/kinoeyes/still-01.jpg",
      "../assets/videography/kinoeyes/still-02.jpg",
      "../assets/videography/kinoeyes/still-03.jpg",
    ],
  },
  {
    file: "../assets/videography/loading/still-01.jpg",
    name: "Loading",
    type: "Experimental docu-fiction",
    year: "01:34",
    video: "../assets/videography/loading/video.mp4",
    stills: [
      "../assets/videography/loading/still-01.jpg",
      "../assets/videography/loading/still-02.jpg",
      "../assets/videography/loading/still-03.jpg",
    ],
  },
  {
    file: "../assets/videography/escape/still-01.jpg",
    name: "Escape",
    type: "Photo Roman",
    year: "02:48",
    video: "../assets/videography/escape/video.mp4",
    stills: [
      "../assets/videography/escape/still-01.jpg",
      "../assets/videography/escape/still-02.jpg",
      "../assets/videography/escape/still-03.jpg",
      "../assets/videography/escape/still-04.jpg",
      "../assets/videography/escape/still-05.jpg",
    ],
  },
];

export const IMAGE_FILES = PROJECTS.map((p) => p.file);
