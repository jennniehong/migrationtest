FROM perl:5.34

# Install system dependencies and build tools
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    libaio1 \
    libdbi-perl \
    build-essential \
    libdbd-pg-perl \
    && rm -rf /var/lib/apt/lists/*

# Setup Oracle Instant Client (Linux Basic + SDK)
COPY instantclient-*-linux.x64-*.zip /tmp/
RUN mkdir -p /usr/lib/instantclient \
    && unzip /tmp/instantclient-basic-linux.x64-*.zip -d /tmp/ic_basic \
    && unzip /tmp/instantclient-sdk-linux.x64-*.zip -d /tmp/ic_sdk \
    && cp -r /tmp/ic_basic/instantclient_*/* /usr/lib/instantclient/ \
    && cp -r /tmp/ic_sdk/instantclient_*/* /usr/lib/instantclient/ \
    && rm -rf /tmp/ic_basic /tmp/ic_sdk /tmp/*.zip \
    && find /usr/lib/instantclient -name "libclntsh.so.*" -exec ln -s {} /usr/lib/instantclient/libclntsh.so \;

ENV LD_LIBRARY_PATH=/usr/lib/instantclient
ENV ORACLE_HOME=/usr/lib/instantclient

# Install DBD::Oracle via CPAN (more reliable than apt for this specific module)
RUN cpanm DBD::Oracle

# Install Ora2Pg
ENV ORA2PG_VERSION 24.3
RUN wget https://github.com/darold/ora2pg/archive/v${ORA2PG_VERSION}.tar.gz \
    && tar xzf v${ORA2PG_VERSION}.tar.gz \
    && cd ora2pg-${ORA2PG_VERSION} \
    && perl Makefile.PL \
    && make && make install \
    && cd .. && rm -rf ora2pg-${ORA2PG_VERSION} v${ORA2PG_VERSION}.tar.gz

WORKDIR /data
ENTRYPOINT ["ora2pg"]
