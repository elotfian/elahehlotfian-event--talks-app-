import os
import time
import requests
import feedparser
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, send_from_directory

app = Flask(__name__, static_folder='static', template_folder='templates')

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_DURATION_SECS = 600  # 10 minutes cache

# Global cache dictionary
feed_cache = {
    "data": None,
    "last_updated": 0
}

def parse_release_notes():
    """Fetches and parses the BigQuery release notes XML feed."""
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        xml_content = response.text
    except Exception as e:
        print(f"Error fetching feed: {e}")
        # If fetch fails, return None to indicate we should use stale cache if available
        return None

    feed = feedparser.parse(xml_content)
    parsed_items = []
    
    # We will counter-index items to give them unique IDs
    item_counter = 0
    
    for entry in feed.entries:
        date = entry.get('title', 'Unknown Date')
        timestamp = entry.get('updated', '')
        base_link = entry.get('link', 'https://cloud.google.com/bigquery/docs/release-notes')
        
        # Feedparser resolves summary/content. Atom feeds usually have content inside content list
        content_html = ""
        if entry.get('content'):
            content_html = entry.get('content')[0].value
        elif entry.get('summary'):
            content_html = entry.get('summary')
            
        if not content_html:
            continue
            
        soup = BeautifulSoup(content_html, 'html.parser')
        
        current_type = None
        current_html_parts = []
        
        for element in soup.contents:
            # If the child element is an <h3> tag, it defines the section type (e.g., Feature, Change)
            if hasattr(element, 'name') and element.name == 'h3':
                # Save the accumulated item if we have one
                if current_type is not None and current_html_parts:
                    item_html = "".join(str(p) for p in current_html_parts).strip()
                    item_text = BeautifulSoup(item_html, 'html.parser').get_text(separator=' ').strip()
                    # Clean up double spacing and empty lines
                    item_text = " ".join(item_text.split())
                    
                    parsed_items.append({
                        "id": f"item-{item_counter}",
                        "date": date,
                        "timestamp": timestamp,
                        "type": current_type.strip(),
                        "html": item_html,
                        "text": item_text,
                        "link": base_link
                    })
                    item_counter += 1
                
                # Reset for the new section
                current_type = element.get_text().strip()
                current_html_parts = []
            else:
                if current_type is not None:
                    current_html_parts.append(element)
                else:
                    # Sometimes there is introductory text before the first <h3> (uncommon, but handles robustly)
                    pass
        
        # Save the final accumulated section of this entry
        if current_type is not None and current_html_parts:
            item_html = "".join(str(p) for p in current_html_parts).strip()
            item_text = BeautifulSoup(item_html, 'html.parser').get_text(separator=' ').strip()
            item_text = " ".join(item_text.split())
            
            parsed_items.append({
                "id": f"item-{item_counter}",
                "date": date,
                "timestamp": timestamp,
                "type": current_type.strip(),
                "html": item_html,
                "text": item_text,
                "link": base_link
            })
            item_counter += 1
            
    return parsed_items

@app.route('/')
def index():
    """Serves the main application page."""
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    """API endpoint to get parsed release notes, with caching."""
    current_time = time.time()
    
    # Check if we should serve from cache
    if (feed_cache["data"] is not None and 
            (current_time - feed_cache["last_updated"]) < CACHE_DURATION_SECS):
        return jsonify({
            "status": "success",
            "source": "cache",
            "last_updated": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(feed_cache["last_updated"])),
            "data": feed_cache["data"]
        })
        
    # Attempt to fetch fresh data
    fresh_data = parse_release_notes()
    
    if fresh_data is not None:
        feed_cache["data"] = fresh_data
        feed_cache["last_updated"] = current_time
        return jsonify({
            "status": "success",
            "source": "network",
            "last_updated": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(current_time)),
            "data": fresh_data
        })
    elif feed_cache["data"] is not None:
        # Fetch failed, but we have stale cache - serve it with a warning
        return jsonify({
            "status": "warning",
            "message": "Failed to fetch fresh data. Serving cached version.",
            "source": "stale_cache",
            "last_updated": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(feed_cache["last_updated"])),
            "data": feed_cache["data"]
        })
    else:
        # Fetch failed and no cache exists
        return jsonify({
            "status": "error",
            "message": "Failed to retrieve release notes and no cached data is available."
        }), 500

@app.route('/api/releases/force-refresh')
def force_refresh():
    """Forces cache bypass and retrieves new release notes."""
    fresh_data = parse_release_notes()
    if fresh_data is not None:
        current_time = time.time()
        feed_cache["data"] = fresh_data
        feed_cache["last_updated"] = current_time
        return jsonify({
            "status": "success",
            "source": "network_force",
            "last_updated": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(current_time)),
            "data": fresh_data
        })
    else:
        return jsonify({
            "status": "error",
            "message": "Failed to refresh release notes. Please check feed connectivity."
        }), 500

if __name__ == '__main__':
    # Using host='127.0.0.1' and port=5000 for standard local development
    app.run(debug=True, host='127.0.0.1', port=5000)
