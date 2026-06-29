#!/usr/bin/env bash
# Spring Boot 4 — Project Initializer
# Usage: ./scripts/init-project.sh [group-id] [artifact-id] [java-version]

set -euo pipefail

GROUP="${1:-com.example}"
ARTIFACT="${2:-my-service}"
JAVA_VERSION="${3:-21}"
SB_VERSION="4.1.0"

echo "==> Generating Spring Boot ${SB_VERSION} project: ${GROUP}:${ARTIFACT}"

curl -s "https://start.spring.io/starter.tgz" \
  -d type=maven-project \
  -d language=java \
  -d bootVersion=${SB_VERSION} \
  -d groupId=${GROUP} \
  -d artifactId=${ARTIFACT} \
  -d javaVersion=${JAVA_VERSION} \
  -d dependencies=web,actuator,data-jpa,security,validation,opentelemetry \
  | tar -xzvf -

echo ""
echo "==> Project generated in ./${ARTIFACT}/"
echo "==> Next steps:"
echo "    cd ${ARTIFACT}"
echo "    ./mvnw spring-boot:run"
