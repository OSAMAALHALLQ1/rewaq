---
name: skill-library
description: Searchable router and index for all reference/library skills that are not loaded daily in the active project.
---

# 📚 Skill Library Router

This project is configured with a trimmed, project-specific set of **DAILY** skills to minimize context window overhead and improve agent speed. All other skills are classified as **LIBRARY** references.

If you (the AI agent) need to handle tasks involving the technologies below, you should read their detailed instructions directly from the **Global Customization Root** at `C:\Users\M.S.I\.gemini\config\skills\<skill-name>\SKILL.md`.

---

## 🔍 Inactive Library Skills Index

### 🐍 Python & Backend Frameworks
* **Django**: `django-patterns`, `django-security`, `django-tdd`, `django-verification`, `django-celery`
* **FastAPI**: `fastapi-patterns`
* **Python Utilities**: `python-patterns`, `python-testing`, `pytorch-patterns`

### ☕ Java & Enterprise Frameworks
* **Spring Boot**: `springboot-patterns`, `springboot-security`, `springboot-tdd`, `springboot-verification`
* **Quarkus**: `quarkus-patterns`, `quarkus-security`, `quarkus-tdd`, `quarkus-verification`
* **Java Utilities**: `java-coding-standards`, `jpa-patterns`, `tinystruct-patterns`

### 🦀 System Languages & Others
* **Rust**: `rust-patterns`, `rust-testing`
* **Go**: `golang-patterns`, `golang-testing`
* **C++**: `cpp-coding-standards`, `cpp-testing`
* **C# / .NET / F#**: `dotnet-patterns`, `csharp-testing`, `fsharp-testing`
* **Perl**: `perl-patterns`, `perl-security`, `perl-testing`

### 📱 Mobile Development
* **Swift & iOS**: `swiftui-patterns`, `swift-concurrency-6-2`, `swift-protocol-di-testing`, `swift-actor-persistence`, `liquid-glass-design`
* **Flutter & Android**: `flutter-dart-code-review`, `compose-multiplatform-patterns`, `android-clean-architecture`

### 🌐 Infrastructure, Docker & Networking
* **Docker**: `docker-patterns`
* **Network Automation**: `netmiko-ssh-automation`, `cisco-ios-patterns`, `network-bgp-diagnostics`, `network-config-validation`, `network-interface-health`
* **Homelab / Home Network**: `homelab-network-setup`, `homelab-network-readiness`, `homelab-pihole-dns`, `homelab-vlan-segmentation`, `homelab-wireguard-vpn`

### 🏥 Healthcare & Privacy Compliance
* **Healthcare App Standards**: `healthcare-emr-patterns`, `healthcare-cdss-patterns`, `healthcare-phi-compliance`, `healthcare-eval-harness`
* **Compliance**: `hipaa-compliance`

### 🎬 Media & Video Production
* **FFmpeg & Video editing**: `ffmpeg-video-editor`
* **Remotion / Manim**: `remotion-video-creation`, `manim-video`
* **AI Media Generation**: `fal-ai-media`

### 🔬 Scientific Research & Databases
* **Biomedical & Patents**: `scientific-thinking-literature-review`, `scientific-thinking-scholar-evaluation`, `scientific-pkg-gget`, `scientific-db-pubmed-database`, `scientific-db-uspto-database`

### 📈 Web Scraping & Integrations
* **Exa & Deep Research**: `exa-search`, `deep-research`
* **Social APIs**: `x-api`, `crosspost`
* **Integrations**: `jira-integration`, `google-workspace-ops`

---

## ⚡ Triggering Reference Skills

To use a reference skill, retrieve its body dynamically using the `view_file` tool:
`view_file(AbsolutePath="C:\Users\M.S.I\.gemini\config\skills\<skill-name>\SKILL.md")`
