# GenSMBIOS
Py script that uses acidanthera's macserial to generate SMBIOS and optionally saves them to a plist.

***

## To install:

Do the following one line at a time in Terminal:

    git clone https://github.com/corpnewt/GenSMBIOS
    cd GenSMBIOS
    chmod +x GenSMBIOS.command
    
Then run with either `./GenSMBIOS.command` or by double-clicking *GenSMBIOS.command*

***

## Web UI (optional)

A local browser interface is included. It still uses the `macserial` binary
under the hood, so it runs a small Flask server instead of being a static page:

    python3 -m pip install -r requirements-web.txt
    ./GenSMBIOS_web.command

Then open <http://127.0.0.1:8080>. See [WEBUI.md](WEBUI.md) for details.

***

## Thanks to:

* acidanthera and crew for the [macserial](https://github.com/acidanthera/macserial) application
