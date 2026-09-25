"use client";

import { useState } from "react";
import Carousel from "@/components/Carousel";
import { BASE_PATH } from "@/components/ring/projects";

export default function Page() {
  const [activeProject, setActiveProject] = useState(null);

  return (
    <main className="showcase-page">
      <header className="portfolio-header">
        <nav className="primary-nav" aria-label="Portfolio sections">
          <a className="nav-home" href="../index.html">
            Home
          </a>
          <div className="nav-sections">
            <a href="#" aria-disabled="true">
              Photography
            </a>
            <a className="is-current" href="./" aria-current="page">
              Videography
            </a>
            <a href="../graphic-design.html">Graphic Design</a>
            <a href="#" aria-disabled="true">
              About
            </a>
          </div>
        </nav>
      </header>

      <Carousel onOpenProject={setActiveProject} />

      {activeProject ? (
        <section
          className="project-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-title"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setActiveProject(null);
          }}
        >
          <div className="project-modal">
            <header className="project-modal__header">
              <div>
                <p>
                  {activeProject.type} · {activeProject.year}
                </p>
                <h1 id="project-title">{activeProject.name}</h1>
              </div>
              <button type="button" onClick={() => setActiveProject(null)}>
                <span aria-hidden="true">×</span> Close
              </button>
            </header>

            <video
              key={activeProject.video}
              className="project-video"
              controls
              playsInline
              preload="metadata"
              poster={`${BASE_PATH}/${activeProject.file}`}
              src={`${BASE_PATH}/${activeProject.video}`}
            />

            {activeProject.stills.length ? (
              <section className="project-stills" aria-labelledby="stills-title">
                <div className="project-stills__heading">
                  <h2 id="stills-title">Selected Stills</h2>
                  <p>{String(activeProject.stills.length).padStart(2, "0")} images</p>
                </div>
                <div className="project-stills__grid">
                  {activeProject.stills.map((still, index) => (
                    <img
                      key={still}
                      src={`${BASE_PATH}/${still}`}
                      alt={`${activeProject.name} — selected still ${index + 1}`}
                      loading="lazy"
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
